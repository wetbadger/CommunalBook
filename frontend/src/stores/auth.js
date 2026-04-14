import { defineStore } from 'pinia'
import axios from 'axios'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token'),
    user: null
  }),
  
  getters: {
    isAuthenticated: (state) => !!state.token,
    currentUser: (state) => state.user,
    deleteCredits: (state) => state.user?.deleteCredits || 0,
    wordsWritten: (state) => state.user?.wordsWritten || 0
  },
  
  actions: {
    setAuth(token, user) {
      this.token = token
      this.user = user
      localStorage.setItem('token', token)
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    },
    
    clearAuth() {
      this.token = null
      this.user = null
      localStorage.removeItem('token')
      delete axios.defaults.headers.common['Authorization']
    },
    
    async login(username, password) {
      try {
        const response = await axios.post('/api/auth/login', { username, password })
        this.setAuth(response.data.token, response.data.user)
        return { success: true }
      } catch (error) {
        return { success: false, message: error.response?.data?.message || 'Login failed' }
      }
    },
    
    async register(username, password) {
      try {
        const response = await axios.post('/api/auth/register', { username, password })
        this.setAuth(response.data.token, response.data.user)
        return { success: true }
      } catch (error) {
        return { success: false, message: error.response?.data?.message || 'Registration failed' }
      }
    },
    
    async fetchUserStats() {
      if (!this.token) return
      try {
        const response = await axios.get('/api/book/user-stats')
        this.user = { ...this.user, ...response.data }
      } catch (error) {
        console.error('Error fetching user stats:', error)
      }
    },
    
    logout() {
      this.clearAuth()
    }
  }
})