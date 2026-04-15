import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import Book from '../views/Book.vue'
import Home from '../views/Home.vue'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/', component: Home },
  { path: '/login', component: Login, meta: { requiresGuest: true } },
  { path: '/register', component: Register, meta: { requiresGuest: true } },
  { path: '/book', component: Book, meta: { requiresAuth: true } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return '/login'
  } else if (to.meta.requiresGuest && authStore.isAuthenticated) {
    return '/book'
  } else {
    return true
  }
})

export default router
