// stores/book.js

import { defineStore } from 'pinia'
import axios from 'axios'

export const useBookStore = defineStore('book', {
  state: () => ({
    words: [],
    loading: false,
    error: null
  }),
  
  getters: {
    bookText: (state) => state.words.map(w => w.text).join(' '),
    wordCount: (state) => state.words.length
  },
  
  actions: {
// frontend/src/stores/book.js - Add method to get deletion cost
async getDeletionCost(wordId) {
  try {
    const response = await axios.get(`/api/book/words/${wordId}/deletion-cost`);
    return response.data;
  } catch (error) {
    console.error('Error getting deletion cost:', error);
    return { cost: 1, likes: 0 };
  }
},
    
// stores/book.js
// stores/book.js

async addWord(wordText, insertAtPosition = null) {
  try {
    const payload = { text: wordText };
    if (insertAtPosition !== null && insertAtPosition !== undefined) {
      payload.insertAtPosition = insertAtPosition;
    }
    
    const response = await axios.post('/api/book/words', payload);
    
    // Refetch all words to get updated positions
    await this.fetchWords();
    
    return { success: true, word: response.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || 'Failed to add word' };
  }
},
    
    async deleteWord(position) {
      try {
        const response = await axios.delete(`/api/book/words/${position}`)
        this.words = this.words.filter(w => w.position !== position)
        // Update positions of words after the deleted one
        this.words.forEach(word => {
          if (word.position > position) {
            word.position -= 1
          }
        })
        return { success: true, credits: response.data.remainingCredits }
      } catch (error) {
        return { success: false, message: error.response?.data?.message || 'Failed to delete word' }
      }
    },
    
    async deleteAllWords() {
      try {
        const response = await axios.delete('/api/book/words')
        this.words = []
        return { success: true, deletedCount: response.data.deletedCount }
      } catch (error) {
        return { success: false, message: error.response?.data?.message || 'Failed to delete all words' }
      }
    },
// Add these actions to your existing book store

async likeWord(wordId) {
  try {
    const response = await axios.post(`/api/book/words/${wordId}/like`);
    
    // Update the word in the local store
    const word = this.words.find(w => w._id === wordId);
    if (word) {
      word.likes = response.data.likes;
      word.userLiked = true;
    }
    
    return { success: true, likes: response.data.likes };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || 'Failed to like word' };
  }
},

async unlikeWord(wordId) {
  try {
    const response = await axios.delete(`/api/book/words/${wordId}/like`);
    
    // Update the word in the local store
    const word = this.words.find(w => w._id === wordId);
    if (word) {
      word.likes = response.data.likes;
      word.userLiked = false;
    }
    
    return { success: true, likes: response.data.likes };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || 'Failed to unlike word' };
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

// Modify fetchWords to include user like status
async fetchWords() {
  this.loading = true
  try {
    const response = await axios.get('/api/book/words')
    this.words = response.data
    
    // If user is authenticated, check like status for each word
    const token = localStorage.getItem('token')
    if (token) {
      for (const word of this.words) {
        const likeStatus = await this.checkLikeStatus(word._id)
        word.userLiked = likeStatus.liked
        word.likes = likeStatus.likes
      }
    }
    
    this.error = null
  } catch (error) {
    this.error = 'Failed to load the book'
    console.error(error)
  } finally {
    this.loading = false
  }
}
  }
})
