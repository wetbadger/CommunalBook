<template>
  <div class="back-link" :class="customClass">
    <router-link to="/" class="home-link">
      <span class="arrow">←</span>
      <span class="text">{{ text }}</span>
    </router-link>
  </div>
</template>

<script setup>
defineProps({
  text: {
    type: String,
    default: 'Back to Home'
  },
  customClass: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.back-link {
  margin-bottom: 1.5rem;
}

.home-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: #667eea;
  text-decoration: none;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  padding: 0.25rem 0;
}

.home-link:hover {
  color: #5a67d8;
  transform: translateX(-2px);
}

.arrow {
  font-size: 1.1rem;
  transition: transform 0.3s ease;
}

.home-link:hover .arrow {
  transform: translateX(-2px);
}

.text {
  line-height: 1;
}

/* Responsive */
@media (max-width: 480px) {
  .home-link {
    font-size: 0.85rem;
  }
  
  .arrow {
    font-size: 1rem;
  }
}
</style>