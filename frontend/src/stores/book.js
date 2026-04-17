// frontend/src/stores/book.js - Full version with all features

import { defineStore } from 'pinia'
import axios from 'axios'
import { io } from 'socket.io-client'
import { generateIdempotencyKey, idempotencyTracker } from '../utils/idempotency'

export const useBookStore = defineStore('book', {
  state: () => ({
    words: [],
    loading: false,
    error: null,
    isDeleting: false,
    isAdding: false,
    isLiking: false,
    socket: null,
    needsInitialLoad: true,
    _updateLock: false // Prevent recursive updates
  }),
  
  getters: {
    bookText: (state) => state.words.map(w => w.text).join(' '),
    wordCount: (state) => state.words.length
  },
  
  actions: {
    // Initial load - only happens once when app starts
    async loadInitialBook() {
      if (!this.needsInitialLoad) return
      
      this.loading = true
      try {
        const response = await axios.get('/api/book/words')
        this.words = response.data
        this.needsInitialLoad = false
        
        // Load like statuses in background (don't block UI)
        this.loadLikeStatusesInBackground()
      } catch (error) {
        this.error = 'Failed to load the book'
        console.error(error)
      } finally {
        this.loading = false
      }
    },
    
    async loadLikeStatusesInBackground() {
      const token = localStorage.getItem('token')
      if (!token) return
      
      // Load in small batches to not block UI
      const batchSize = 20
      for (let i = 0; i < this.words.length; i += batchSize) {
        const batch = this.words.slice(i, i + batchSize)
        await Promise.all(
          batch.map(async (word) => {
            const likeStatus = await this.checkLikeStatus(word._id)
            word.userLiked = likeStatus.liked
            word.likes = likeStatus.likes
          })
        )
      }
    },
    
    async getDeletionCost(wordId) {
      try {
        const response = await axios.get(`/api/book/words/${wordId}/deletion-cost`);
        return response.data;
      } catch (error) {
        console.error('Error getting deletion cost:', error);
        return { cost: 1, likes: 0 };
      }
    },
    
    // Add word with full idempotency support
    async addWord(wordText, options = {}) {
      if (this.isAdding) {
        return { success: false, message: 'Already adding a word, please wait...' };
      }
      
      this.isAdding = true;
      
      // Generate operation key for idempotency
      const operationKey = options.insertAfterWordId || options.insertBeforeWordId || 'append';
      const idempotencyKey = generateIdempotencyKey('add-word', `${wordText}-${operationKey}`);
      
      if (idempotencyTracker.isPending(idempotencyKey)) {
        this.isAdding = false;
        return { success: false, message: 'This word is already being added' };
      }
      
      idempotencyTracker.addPending(idempotencyKey);
      
      // Create optimistic word for instant UI update
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      let insertIndex = this.calculateInsertPosition(options);
      
      const optimisticWord = {
        _id: tempId,
        text: wordText,
        author: this.authStore?.currentUser?.id,
        authorName: this.authStore?.currentUser?.username,
        likes: 0,
        likedBy: [],
        userLiked: false,
        createdAt: new Date(),
        _optimistic: true,
        _tempId: tempId
      };
      
      // Insert optimistically
      this.words.splice(insertIndex, 0, optimisticWord);
      
      try {
        const payload = { text: wordText };
        if (options.insertAfterWordId) {
          payload.insertAfterWordId = options.insertAfterWordId;
        } else if (options.insertBeforeWordId) {
          payload.insertBeforeWordId = options.insertBeforeWordId;
        }
        
        const response = await axios.post('/api/book/words', payload, {
          headers: { 'Idempotency-Key': idempotencyKey }
        });
        
        // Replace optimistic with real word
        const index = this.words.findIndex(w => w._tempId === tempId);
        if (index !== -1) {
          this.words[index] = { ...response.data, _justAdded: true };
          setTimeout(() => {
            const word = this.words.find(w => w._id === response.data._id);
            if (word) delete word._justAdded;
          }, 300);
        }
        
        // Broadcast to other users
        if (this.socket) {
          this.socket.emit('word-added', response.data);
        }
        
        return { success: true, word: response.data };
      } catch (error) {
        // Remove optimistic word on failure
        const index = this.words.findIndex(w => w._tempId === tempId);
        if (index !== -1) {
          this.words.splice(index, 1);
        }
        
        if (error.response?.status === 409) {
          await this.syncIncremental();
          return { success: true, message: 'Word was already added' };
        }
        
        return { success: false, message: error.response?.data?.message || 'Failed to add word' };
      } finally {
        this.isAdding = false;
        idempotencyTracker.removePending(idempotencyKey);
      }
    },
    
    calculateInsertPosition(options) {
      if (options.insertAfterWordId) {
        const afterIndex = this.words.findIndex(w => w._id === options.insertAfterWordId);
        if (afterIndex !== -1) return afterIndex + 1;
      } else if (options.insertBeforeWordId) {
        const beforeIndex = this.words.findIndex(w => w._id === options.insertBeforeWordId);
        if (beforeIndex !== -1) return beforeIndex;
      }
      return this.words.length; // Append to end
    },
    
    // Delete word with idempotency
    async deleteWordById(wordId) {
      if (this.isDeleting) {
        return { success: false, message: 'Another deletion is in progress, please wait...' };
      }
      
      this.isDeleting = true;
      
      const idempotencyKey = generateIdempotencyKey('delete-word', wordId);
      
      if (idempotencyTracker.isPending(idempotencyKey)) {
        this.isDeleting = false;
        return { success: false, message: 'This word is already being deleted' };
      }
      
      idempotencyTracker.addPending(idempotencyKey);
      
      // Find word and mark as deleting optimistically
      const index = this.words.findIndex(w => w._id === wordId);
      if (index === -1) {
        this.isDeleting = false;
        idempotencyTracker.removePending(idempotencyKey);
        return { success: false, message: 'Word not found' };
      }
      
      const deletedWord = this.words[index];
      this.words[index]._deleting = true;
      
      try {
        const response = await axios.delete(`/api/book/words/${wordId}`, {
          headers: { 'Idempotency-Key': idempotencyKey }
        });
        
        // Remove from UI with animation
        this.words.splice(index, 1);
        
        // Broadcast to other users
        if (this.socket) {
          this.socket.emit('word-deleted', { wordId });
        }
        
        return { 
          success: true, 
          remainingCredits: response.data.remainingCredits,
          cost: response.data.cost,
          deletedWordId: wordId
        };
      } catch (error) {
        // Restore word on failure
        if (this.words[index]) {
          delete this.words[index]._deleting;
        }
        
        if (error.response?.status === 409) {
          await this.syncIncremental();
          return { 
            success: false, 
            message: 'This word has already been deleted',
            alreadyDeleted: true
          };
        }
        
        return { 
          success: false, 
          message: error.response?.data?.message || 'Failed to delete word' 
        };
      } finally {
        this.isDeleting = false;
        idempotencyTracker.removePending(idempotencyKey);
      }
    },
    
    // Like word with idempotency
    async likeWord(wordId) {
      if (this.isLiking) {
        return { success: false, message: 'Please wait, finishing previous like operation...' };
      }
      
      this.isLiking = true;
      
      const idempotencyKey = generateIdempotencyKey('like-word', wordId);
      
      if (idempotencyTracker.isPending(idempotencyKey)) {
        this.isLiking = false;
        return { success: false, message: 'Already processing this like' };
      }
      
      idempotencyTracker.addPending(idempotencyKey);
      
      // Update optimistically
      const word = this.words.find(w => w._id === wordId);
      if (word) {
        const oldLikes = word.likes;
        word.likes += 1;
        word.userLiked = true;
        word._optimisticLike = true;
        
        try {
          const response = await axios.post(`/api/book/words/${wordId}/like`, {}, {
            headers: { 'Idempotency-Key': idempotencyKey }
          });
          
          // Sync final state
          word.likes = response.data.likes;
          word.userLiked = response.data.liked;
          delete word._optimisticLike;
          
          return { success: true, likes: response.data.likes };
        } catch (error) {
          // Rollback on error
          word.likes = oldLikes;
          word.userLiked = false;
          delete word._optimisticLike;
          
          if (error.response?.status === 409) {
            return { success: false, message: 'You already liked this word' };
          }
          
          return { success: false, message: error.response?.data?.message || 'Failed to like word' };
        } finally {
          this.isLiking = false;
          idempotencyTracker.removePending(idempotencyKey);
        }
      }
      
      this.isLiking = false;
      return { success: false, message: 'Word not found' };
    },
    
    // Unlike word with idempotency
    async unlikeWord(wordId) {
      if (this.isLiking) {
        return { success: false, message: 'Please wait, finishing previous operation...' };
      }
      
      this.isLiking = true;
      
      const idempotencyKey = generateIdempotencyKey('unlike-word', wordId);
      
      if (idempotencyTracker.isPending(idempotencyKey)) {
        this.isLiking = false;
        return { success: false, message: 'Already processing this unlike' };
      }
      
      idempotencyTracker.addPending(idempotencyKey);
      
      // Update optimistically
      const word = this.words.find(w => w._id === wordId);
      if (word) {
        const oldLikes = word.likes;
        word.likes -= 1;
        word.userLiked = false;
        word._optimisticLike = true;
        
        try {
          const response = await axios.delete(`/api/book/words/${wordId}/like`, {
            headers: { 'Idempotency-Key': idempotencyKey }
          });
          
          // Sync final state
          word.likes = response.data.likes;
          word.userLiked = response.data.liked;
          delete word._optimisticLike;
          
          return { success: true, likes: response.data.likes };
        } catch (error) {
          // Rollback on error
          word.likes = oldLikes;
          word.userLiked = true;
          delete word._optimisticLike;
          
          if (error.response?.status === 409) {
            return { success: false, message: 'You already unliked this word' };
          }
          
          return { success: false, message: error.response?.data?.message || 'Failed to unlike word' };
        } finally {
          this.isLiking = false;
          idempotencyTracker.removePending(idempotencyKey);
        }
      }
      
      this.isLiking = false;
      return { success: false, message: 'Word not found' };
    },
    
    async checkLikeStatus(wordId) {
      try {
        const response = await axios.get(`/api/book/words/${wordId}/like-status`);
        return response.data;
      } catch (error) {
        console.error('Error checking like status:', error);
        return { liked: false, likes: 0 };
      }
    },
    
    async deleteAllWords() {
      if (this.isDeleting) {
        return { success: false, message: 'A deletion is already in progress' };
      }
      
      this.isDeleting = true;
      
      const idempotencyKey = generateIdempotencyKey('delete-all-words', Date.now().toString());
      
      if (idempotencyTracker.isPending(idempotencyKey)) {
        this.isDeleting = false;
        return { success: false, message: 'Delete all operation already in progress' };
      }
      
      idempotencyTracker.addPending(idempotencyKey);
      
      try {
        const response = await axios.delete('/api/book/words', {
          headers: { 'Idempotency-Key': idempotencyKey }
        });
        
        this.words = [];
        
        if (this.socket) {
          this.socket.emit('words-cleared');
        }
        
        return { success: true, deletedCount: response.data.deletedCount };
      } catch (error) {
        if (error.response?.status === 409) {
          await this.syncIncremental();
          return { success: false, message: 'Delete all operation already performed' };
        }
        
        return { success: false, message: error.response?.data?.message || 'Failed to delete all words' };
      } finally {
        this.isDeleting = false;
        idempotencyTracker.removePending(idempotencyKey);
      }
    },
    
    // Incremental sync - only fetch changes, not full reload
    async syncIncremental() {
      if (this._updateLock) return;
      
      this._updateLock = true;
      
      try {
        const response = await axios.get('/api/book/words');
        const serverWords = response.data;
        
        // Create maps for comparison
        const serverMap = new Map(serverWords.map(w => [w._id, w]));
        const localMap = new Map(this.words.map(w => [w._id, w]));
        
        // Find added words (in server but not in local)
        for (const serverWord of serverWords) {
          if (!localMap.has(serverWord._id)) {
            // Find correct position
            const prevWordId = serverWord.prevWord;
            let insertIndex = this.words.length;
            
            if (prevWordId) {
              const prevIndex = this.words.findIndex(w => w._id === prevWordId);
              if (prevIndex !== -1) {
                insertIndex = prevIndex + 1;
              }
            } else {
              insertIndex = 0; // Insert at beginning
            }
            
            this.words.splice(insertIndex, 0, {
              ...serverWord,
              _fromSync: true
            });
            
            setTimeout(() => {
              const word = this.words.find(w => w._id === serverWord._id);
              if (word) delete word._fromSync;
            }, 300);
          }
        }
        
        // Find deleted words (in local but not in server, and not optimistic)
        for (const localWord of this.words) {
          if (!serverMap.has(localWord._id) && !localWord._optimistic) {
            const index = this.words.findIndex(w => w._id === localWord._id);
            if (index !== -1) {
              this.words.splice(index, 1);
            }
          }
        }
        
        // Update like counts for existing words
        for (const serverWord of serverWords) {
          const localWord = localMap.get(serverWord._id);
          if (localWord && localWord.likes !== serverWord.likes) {
            localWord.likes = serverWord.likes;
            localWord.userLiked = serverWord.userLiked;
          }
        }
      } catch (error) {
        console.error('Incremental sync failed:', error);
      } finally {
        this._updateLock = false;
      }
    },
    
    // Initialize WebSocket for real-time updates
    initWebSocket() {
      this.socket = io('http://localhost:3000', {
        auth: { token: localStorage.getItem('token') }
      });
      
      this.socket.on('word-added', (data) => {
        // Check if we already have this word
        if (!this.words.some(w => w._id === data._id)) {
          this.handleRemoteWordAdded(data);
        }
      });
      
      this.socket.on('word-deleted', (data) => {
        this.handleRemoteWordDeleted(data.wordId);
      });
      
      this.socket.on('words-cleared', () => {
        this.words = [];
      });
    },
    
    handleRemoteWordAdded(newWord) {
      // Find correct insertion position based on linked list
      let insertIndex = this.words.length;
      
      if (newWord.prevWord) {
        const prevIndex = this.words.findIndex(w => w._id === newWord.prevWord);
        if (prevIndex !== -1) {
          insertIndex = prevIndex + 1;
        }
      } else {
        insertIndex = 0;
      }
      
      this.words.splice(insertIndex, 0, {
        ...newWord,
        _remote: true
      });
      
      setTimeout(() => {
        const word = this.words.find(w => w._id === newWord._id);
        if (word) delete word._remote;
      }, 300);
    },
    
    handleRemoteWordDeleted(wordId) {
      const index = this.words.findIndex(w => w._id === wordId);
      if (index !== -1 && !this.words[index]._optimistic) {
        this.words[index]._deleting = true;
        setTimeout(() => {
          const currentIndex = this.words.findIndex(w => w._id === wordId);
          if (currentIndex !== -1) {
            this.words.splice(currentIndex, 1);
          }
        }, 200);
      }
    },
    
    // Periodic background sync (every 10 seconds as fallback)
    startBackgroundSync() {
      this.syncInterval = setInterval(() => {
        if (!this.isAdding && !this.isDeleting && !this.isLiking) {
          this.syncIncremental();
        }
      }, 10000);
    },
    
    stopBackgroundSync() {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
      }
    }
  }
});