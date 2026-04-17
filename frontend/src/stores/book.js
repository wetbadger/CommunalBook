// frontend/src/stores/book.js
import { defineStore } from 'pinia'
import axios from 'axios'
import { generateIdempotencyKey, idempotencyTracker } from '../utils/idempotency'

export const useBookStore = defineStore('book', {
  state: () => ({
    words: [],
    loading: false,
    error: null,
    isDeleting: false,
    isAdding: false,
    isLiking: false
  }),
  
  getters: {
    bookText: (state) => state.words.map(w => w.text).join(' '),
    wordCount: (state) => state.words.length
  },
  
  actions: {
    async getDeletionCost(wordId) {
      try {
        const response = await axios.get(`/api/book/words/${wordId}/deletion-cost`);
        return response.data;
      } catch (error) {
        console.error('Error getting deletion cost:', error);
        return { cost: 1, likes: 0 };
      }
    },
    
    // Add word with insertion options
    async addWord(wordText, options = {}) {
      if (this.isAdding) {
        return { success: false, message: 'Already adding a word, please wait...' };
      }
      
      this.isAdding = true;
      
      // Generate idempotency key based on operation
      const operationKey = options.insertAfterWordId || options.insertBeforeWordId || 'append';
      const idempotencyKey = generateIdempotencyKey('add-word', `${wordText}-${operationKey}`);
      
      if (idempotencyTracker.isPending(idempotencyKey)) {
        this.isAdding = false;
        return { success: false, message: 'This word is already being added' };
      }
      
      idempotencyTracker.addPending(idempotencyKey);
      
      try {
        const payload = { text: wordText };
        if (options.insertAfterWordId) {
          payload.insertAfterWordId = options.insertAfterWordId;
        } else if (options.insertBeforeWordId) {
          payload.insertBeforeWordId = options.insertBeforeWordId;
        }
        
        const response = await axios.post('/api/book/words', payload, {
          headers: {
            'Idempotency-Key': idempotencyKey
          }
        });
        
        await this.fetchWords();
        
        return { success: true, word: response.data };
      } catch (error) {
        if (error.response?.status === 409) {
          console.log('Duplicate add request detected');
          await this.fetchWords();
          return { success: true, message: 'Word was already added' };
        }
        
        return { success: false, message: error.response?.data?.message || 'Failed to add word' };
      } finally {
        this.isAdding = false;
        idempotencyTracker.removePending(idempotencyKey);
      }
    },
    
    // Delete word by ID
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
      
      try {
        const response = await axios.delete(`/api/book/words/${wordId}`, {
          headers: {
            'Idempotency-Key': idempotencyKey
          }
        });
        
        // Update local state - remove the deleted word
        const deletedIndex = this.words.findIndex(w => w._id === wordId);
        if (deletedIndex !== -1) {
          this.words.splice(deletedIndex, 1);
        }
        
        return { 
          success: true, 
          credits: response.data.remainingCredits,
          cost: response.data.cost,
          deletedWordId: wordId
        };
      } catch (error) {
        if (error.response?.status === 409) {
          console.log('Duplicate delete request detected');
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
    
    // Like word
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
      
      try {
        const response = await axios.post(`/api/book/words/${wordId}/like`, {}, {
          headers: {
            'Idempotency-Key': idempotencyKey
          }
        });
        
        const word = this.words.find(w => w._id === wordId);
        if (word) {
          word.likes = response.data.likes;
          word.userLiked = true;
        }
        
        return { success: true, likes: response.data.likes };
      } catch (error) {
        if (error.response?.status === 409) {
          console.log('Duplicate like request detected');
          return { success: false, message: 'You already liked this word' };
        }
        
        return { success: false, message: error.response?.data?.message || 'Failed to like word' };
      } finally {
        this.isLiking = false;
        idempotencyTracker.removePending(idempotencyKey);
      }
    },
    
    // Unlike word
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
      
      try {
        const response = await axios.delete(`/api/book/words/${wordId}/like`, {
          headers: {
            'Idempotency-Key': idempotencyKey
          }
        });
        
        const word = this.words.find(w => w._id === wordId);
        if (word) {
          word.likes = response.data.likes;
          word.userLiked = false;
        }
        
        return { success: true, likes: response.data.likes };
      } catch (error) {
        if (error.response?.status === 409) {
          console.log('Duplicate unlike request detected');
          return { success: false, message: 'You already unliked this word' };
        }
        
        return { success: false, message: error.response?.data?.message || 'Failed to unlike word' };
      } finally {
        this.isLiking = false;
        idempotencyTracker.removePending(idempotencyKey);
      }
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
          headers: {
            'Idempotency-Key': idempotencyKey
          }
        });
        
        this.words = [];
        return { success: true, deletedCount: response.data.deletedCount };
      } catch (error) {
        if (error.response?.status === 409) {
          console.log('Duplicate delete all request detected');
          return { success: false, message: 'Delete all operation already performed' };
        }
        
        return { success: false, message: error.response?.data?.message || 'Failed to delete all words' };
      } finally {
        this.isDeleting = false;
        idempotencyTracker.removePending(idempotencyKey);
      }
    },
    
    async fetchWords() {
      this.loading = true;
      try {
        const response = await axios.get('/api/book/words');
        this.words = response.data;
        
        const token = localStorage.getItem('token');
        if (token) {
          const batchSize = 20;
          for (let i = 0; i < this.words.length; i += batchSize) {
            const batch = this.words.slice(i, i + batchSize);
            await Promise.all(
              batch.map(async (word) => {
                const likeStatus = await this.checkLikeStatus(word._id);
                word.userLiked = likeStatus.liked;
                word.likes = likeStatus.likes;
              })
            );
          }
        }
        
        this.error = null;
      } catch (error) {
        this.error = 'Failed to load the book';
        console.error(error);
      } finally {
        this.loading = false;
      }
    }
  }
});