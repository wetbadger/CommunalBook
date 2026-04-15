<template>
  <div class="auth-container">
    <div class="auth-card">
      <!-- Reusable back button component -->
      <BackToHome />

      <h2>Register for Collaborative Book</h2>
      <form @submit.prevent="handleRegister">
        <div class="form-group">
          <input
            v-model="username"
            type="text"
            placeholder="Username"
            required
          />
        </div>
        <div class="form-group">
          <input
            v-model="password"
            type="password"
            placeholder="Password"
            required
          />
        </div>
        <button type="submit" :disabled="loading">Register</button>
        <p v-if="error" class="error">{{ error }}</p>
        <p>Already have an account? <router-link to="/login">Login</router-link></p>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import BackToHome from '../components/BackToHome.vue' // Adjust path as needed

const router = useRouter()
const authStore = useAuthStore()
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const handleRegister = async () => {
  loading.value = true
  error.value = ''
  const result = await authStore.register(username.value, password.value)
  if (result.success) {
    router.push('/book')
  } else {
    error.value = result.message
  }
  loading.value = false
}
</script>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.auth-card {
  background: white;
  padding: 2rem;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
}

.auth-card h2 {
  text-align: center;
  margin-bottom: 2rem;
  color: #333;
}

.form-group {
  margin-bottom: 1rem;
}

input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 1rem;
}

button {
  width: 100%;
  padding: 0.75rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 1rem;
  cursor: pointer;
}

button:hover:not(:disabled) {
  background: #5a67d8;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  color: #e53e3e;
  margin-top: 1rem;
  text-align: center;
}

p {
  text-align: center;
  margin-top: 1rem;
}

a {
  color: #667eea;
  text-decoration: none;
}
</style>