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
    async fetchWords() {
      this.loading = true
      try {
        const response = await axios.get('/api/book/words')
        this.words = response.data
        this.error = null
      } catch (error) {
        this.error = 'Failed to load the book'
        console.error(error)
      } finally {
        this.loading = false
      }
    },
    
    async addWord(wordText) {
      try {
        const response = await axios.post('/api/book/words', { text: wordText })
        this.words.push(response.data)
        return { success: true }
      } catch (error) {
        return { success: false, message: error.response?.data?.message || 'Failed to add word' }
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
    }
  }
})
