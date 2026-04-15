<template>
    <ul class="toolbar">
        <li>
            <a href="/login">Log in</a>
        </li>
        <li>
            <a href="/register">Register</a>
        </li>
    </ul>

    <h1 class="title">Collaborative Book</h1>

    <div class="document">
        <div 
            v-if="bookStore.loading" 
            class="loading"
        >
            Loading document...
        </div>
        <div 
        v-else 
        class="words-container"
        ref="editorRef"
        >
            <div class="words-wrapper">
                <template v-for="word in bookStore.words" :key="word.id">
                    <!-- Regular word -->
                    <span
                        class="word"
                        @mouseenter="showTooltip($event, word)"
                        @mouseleave="hideTooltip"
                    >
                        {{ word.text }}
                    </span>
                    &nbsp;
                </template>
            </div>
        </div>
    </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useBookStore } from '../stores/book'
const bookStore = useBookStore()

const showTooltip = (event, word) => {
  const tooltip = document.createElement('div')
  tooltip.className = 'word-tooltip'
  tooltip.innerHTML = `
    ✍️ Written by: ${word.authorName}<br>
    ❤️ Likes: ${word.likes || 0}
  `
  tooltip.style.position = 'absolute'
  tooltip.style.left = `${event.clientX + 10}px`
  tooltip.style.top = `${event.clientY - 30}px`
  tooltip.style.backgroundColor = '#2d3748'
  tooltip.style.color = 'white'
  tooltip.style.padding = '4px 8px'
  tooltip.style.borderRadius = '4px'
  tooltip.style.fontSize = '12px'
  tooltip.style.pointerEvents = 'none'
  tooltip.style.zIndex = '1000'
  document.body.appendChild(tooltip)
  event.target._tooltip = tooltip
}

const hideTooltip = (event) => {
  if (event.target._tooltip) {
    event.target._tooltip.remove()
  }
}

onMounted(async () => {
  await bookStore.fetchWords()
})
</script>

<style scoped>
/* Toolbar Styles */
.toolbar {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1rem 2rem;
  margin: 0;
  list-style: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.toolbar li {
  margin: 0;
}

.toolbar a {
  color: white;
  text-decoration: none;
  font-weight: 500;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  transition: all 0.3s ease;
  display: inline-block;
}

.toolbar a:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

/* Title Styles */
.title {
  text-align: center;
  font-size: 3rem;
  font-weight: 800;
  margin-top: 80px;
  margin-bottom: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.02em;
}

/* Document Container */
.document {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  min-height: 500px;
}

/* Loading State */
.loading {
  text-align: center;
  padding: 4rem;
  font-size: 1.2rem;
  color: #667eea;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Words Container */
.words-container {
  min-height: 400px;
  background: #fafbfc;
  border-radius: 12px;
  padding: 2rem;
}

.words-wrapper {
  line-height: 1.8;
  font-size: 1.1rem;
  color: #2d3748;
  word-wrap: break-word;
}

/* Individual Word Styles */
.word {
  display: inline-block;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 2px 4px;
  border-radius: 4px;
  position: relative;
}

.word:hover {
  background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%);
  transform: scale(1.05);
  color: #667eea;
}

/* Tooltip Styles (will be applied dynamically) */
:global(.word-tooltip) {
  animation: fadeIn 0.2s ease;
  font-family: inherit;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  white-space: nowrap;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive Design */
@media (max-width: 768px) {
  .toolbar {
    padding: 0.75rem 1rem;
  }
  
  .toolbar a {
    padding: 0.4rem 0.8rem;
    font-size: 0.9rem;
  }
  
  .title {
    font-size: 2rem;
    margin-top: 70px;
  }
  
  .document {
    margin: 0 1rem;
    padding: 1rem;
  }
  
  .words-container {
    padding: 1rem;
  }
  
  .words-wrapper {
    font-size: 1rem;
    line-height: 1.6;
  }
  
  :global(.word-tooltip) {
    font-size: 10px;
    padding: 3px 6px;
  }
}

/* Dark Mode Support */
@media (prefers-color-scheme: dark) {
  .document {
    background: #1a202c;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  }
  
  .words-container {
    background: #2d3748;
  }
  
  .words-wrapper {
    color: #e2e8f0;
  }
  
  .word:hover {
    background: linear-gradient(135deg, #667eea40 0%, #764ba240 100%);
  }
}

/* Scrollbar Styling */
.words-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.words-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.words-container::-webkit-scrollbar-thumb {
  background: #667eea;
  border-radius: 4px;
}

.words-container::-webkit-scrollbar-thumb:hover {
  background: #764ba2;
}

/* Selection Styling */
::selection {
  background: #667eea40;
  color: #2d3748;
}

::-moz-selection {
  background: #667eea40;
  color: #2d3748;
}

/* Print Styles */
@media print {
  .toolbar {
    display: none;
  }
  
  .title {
    -webkit-text-fill-color: #2d3748;
    background: none;
    color: #2d3748;
  }
  
  .document {
    box-shadow: none;
    padding: 0;
  }
  
  .word:hover {
    background: none;
    transform: none;
  }
}
</style>
