<!-- Book.vue -->

<template>
  <div class="book-container">
    <header class="header">
      <div class="header-left">
        <h1>📖 Collaborative Book</h1>
        <div class="stats">
          <span>✍️ {{ authStore.wordsWritten }} words</span>
          <span>🗑️ {{ authStore.deleteCredits }} credits</span>
        </div>
      </div>
      <div class="user-info">
        <span>👤 {{ authStore.currentUser?.username }}</span>
        <button @click="logout" class="logout-btn">Logout</button>
      </div>
    </header>

    <div class="editor-container">
      <div class="toolbar">
        <button 
          @click="enableDeleteMode" 
          :class="{ active: deleteMode }"
          :disabled="authStore.deleteCredits === 0"
        >
          🗑️ Delete Mode ({{ authStore.deleteCredits }} credits)
        </button>
        <button v-if="deleteMode" @click="cancelDeleteMode" class="cancel-btn">
          Cancel Delete Mode
        </button>
        <div class="info" v-if="deleteMode">
          Click on any word (not yours) to delete it (costs 1 credit)
        </div>
      </div>

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
            <span
              v-for="word in bookStore.words"
              :key="word.id"
              :data-id="word.id"
              :data-position="word.position"
              :data-author-id="word.author"
              :data-author-name="word.authorName"
              class="word"
              :class="{ 
                'deletable': deleteMode && word.author !== authStore.currentUser?.id,
                'own-word': word.author === authStore.currentUser?.id
              }"
              @click="handleWordClick($event, word)"
              @mouseenter="showTooltip($event, word)"
              @mouseleave="hideTooltip"
            >
              {{ word.text }}
            </span>
            <span class="word-separator"> </span>
            <span 
              ref="inputSpanRef"
              class="word own-word input-word"
              contenteditable="true"
              @input="handleInput"
              @keydown="handleKeydown"
              @paste="handlePaste"
              @blur="handleBlur"
            ></span>
          </div>
        </div>
      </div>

      <div class="status-bar">
        <div class="status-left">
          <span>📊 Total words: {{ bookStore.wordCount }}</span>
          <span>👥 Active users: {{ activeUsers }}</span>
        </div>
        <div class="status-right">
          <span v-if="saving">💾 Saving...</span>
          <span v-else>✅ All changes saved</span>
        </div>
      </div>
    </div>

    <div v-if="message" class="message" :class="messageType">
      {{ message }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useBookStore } from '../stores/book'
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

const router = useRouter()
const authStore = useAuthStore()
const bookStore = useBookStore()

const deleteMode = ref(false)
const saving = ref(false)
const message = ref('')
const messageType = ref('info')
const editorRef = ref(null)
const inputSpanRef = ref(null)
const activeUsers = ref(1)
let messageTimeout = null
let isProcessingRemoteUpdate = false

const showMessage = (text, type = 'info') => {
  if (messageTimeout) clearTimeout(messageTimeout)
  message.value = text
  messageType.value = type
  messageTimeout = setTimeout(() => {
    message.value = ''
  }, 3000)
}

const enableDeleteMode = () => {
  if (authStore.deleteCredits > 0) {
    deleteMode.value = true
    showMessage('Delete mode activated! Click on any word (not yours) to delete it (costs 1 credit)', 'info')
  }
}

const cancelDeleteMode = () => {
  deleteMode.value = false
  showMessage('Delete mode deactivated', 'info')
}

const handleWordClick = async (event, word) => {
  if (!deleteMode.value) return
  
  event.preventDefault()
  event.stopPropagation()
  
  if (word.author === authStore.currentUser?.id) {
    showMessage("You can't delete your own words!", 'error')
    return
  }
  
  if (authStore.deleteCredits === 0) {
    showMessage("You don't have any delete credits! Write more words to earn credits (5 words = 1 credit)", 'error')
    deleteMode.value = false
    return
  }
  
  if (confirm(`Delete "${word.text}"? This will cost 1 delete credit.`)) {
    const result = await bookStore.deleteWord(word.position)
    if (result.success) {
      showMessage(`"${word.text}" deleted! ${result.credits} credits remaining.`, 'success')
      await authStore.fetchUserStats()
      if (authStore.deleteCredits === 0) {
        deleteMode.value = false
        showMessage('No delete credits left. Write more words to earn more credits!', 'info')
      }
    } else {
      showMessage(result.message, 'error')
      if (result.message.includes('credits')) {
        deleteMode.value = false
      }
    }
  }
}

const handleInput = (event) => {
  // Just track input, don't do anything else
  const text = event.target.textContent
  if (text.includes(' ') || text.includes('\n')) {
    // Space or enter was typed, submit the word
    submitCurrentWord()
  }
}

const handleKeydown = async (event) => {
  // Submit on space or enter
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault()
    await submitCurrentWord()
    return
  }
  
  // Prevent backspace when input is empty (to avoid deleting previous word)
  if (event.key === 'Backspace' && inputSpanRef.value && inputSpanRef.value.textContent.length === 0) {
    event.preventDefault()
    showMessage('Use delete mode to remove words', 'error')
    return
  }
}

const submitCurrentWord = async () => {
  if (!inputSpanRef.value) return
  
  const wordText = inputSpanRef.value.textContent.trim()
  
  if (wordText && wordText.length > 0) {
    const result = await bookStore.addWord(wordText)
    if (result.success) {
      await authStore.fetchUserStats()
      // Clear the input span
      if (inputSpanRef.value) {
        inputSpanRef.value.textContent = ''
      }
      showMessage(`Added: "${wordText}"`, 'success')
    } else {
      showMessage(result.message, 'error')
    }
  } else {
    // Clear empty input
    if (inputSpanRef.value) {
      inputSpanRef.value.textContent = ''
    }
  }
  
  // Refocus the input span
  await nextTick()
  if (inputSpanRef.value) {
    inputSpanRef.value.focus()
  }
}

const handleBlur = () => {
  // Don't auto-submit on blur to avoid accidental submissions
  // Just clear empty input
  if (inputSpanRef.value && inputSpanRef.value.textContent.trim() === '') {
    inputSpanRef.value.textContent = ''
  }
}

const handlePaste = (event) => {
  event.preventDefault()
  const text = event.clipboardData.getData('text/plain')
  // Only take the first word from paste
  const firstWord = text.trim().split(/\s+/)[0]
  if (firstWord && inputSpanRef.value) {
    inputSpanRef.value.textContent = firstWord
    submitCurrentWord()
  }
}

const showTooltip = (event, word) => {
  const tooltip = document.createElement('div')
  tooltip.className = 'word-tooltip'
  tooltip.textContent = `✍️ Written by: ${word.authorName}`
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

const logout = () => {
  authStore.logout()
  router.push('/login')
}

// Socket.io event handlers
socket.on('word-update', async (data) => {
  if (!isProcessingRemoteUpdate) {
    isProcessingRemoteUpdate = true
    await bookStore.fetchWords()
    isProcessingRemoteUpdate = false
    
    if (!deleteMode.value && data && data.userId !== authStore.currentUser?.id) {
      showMessage(`${data.userName || 'Someone'} added a word`, 'info')
    }
  }
})

socket.on('word-deleted', async (data) => {
  if (!isProcessingRemoteUpdate) {
    isProcessingRemoteUpdate = true
    await bookStore.fetchWords()
    isProcessingRemoteUpdate = false
    
    if (data && data.userId !== authStore.currentUser?.id) {
      showMessage(`${data.userName || 'Someone'} deleted a word`, 'info')
    }
  }
})

onMounted(async () => {
  await bookStore.fetchWords()
  await authStore.fetchUserStats()
  await nextTick()
  
  // Focus the input span
  if (inputSpanRef.value) {
    inputSpanRef.value.focus()
  }
})

onUnmounted(() => {
  if (messageTimeout) clearTimeout(messageTimeout)
})

// Watch for word changes
watch(() => bookStore.words, () => {
  // Don't need to do anything here, Vue will update the DOM
  // Just ensure input span still has focus
  nextTick(() => {
    if (inputSpanRef.value && document.activeElement !== inputSpanRef.value) {
      inputSpanRef.value.focus()
    }
  })
}, { deep: true })
</script>

<style scoped>
.book-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1rem;
  min-height: 100vh;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  margin-bottom: 1rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.header-left h1 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
}

.stats {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: #666;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logout-btn {
  padding: 0.5rem 1rem;
  background: #f56565;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: hidden;
}

.toolbar {
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  gap: 1rem;
  align-items: center;
  background: #fafafa;
  flex-wrap: wrap;
}

.toolbar button {
  padding: 0.5rem 1rem;
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.2s;
}

.toolbar button:hover:not(:disabled) {
  background: #3182ce;
}

.toolbar button.active {
  background: #e53e3e;
}

.toolbar button.active:hover:not(:disabled) {
  background: #c53030;
}

.toolbar button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-btn {
  background: #718096 !important;
}

.cancel-btn:hover {
  background: #4a5568 !important;
}

.info {
  font-size: 0.875rem;
  color: #e53e3e;
}

.document {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
  background: white;
}

.words-container {
  outline: none;
  min-height: 500px;
}

.words-wrapper {
  display: flex;
  flex-wrap: wrap;
  line-height: 1.8;
  font-size: 1.1rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.word {
  display: inline-block;
  margin: 0;
  padding: 0.125rem 0.25rem;
  border-radius: 3px;
  transition: all 0.2s;
  cursor: text;
  white-space: pre;
}

.word-separator {
  display: inline-block;
  width: 0.25rem;
}

.word.own-word {
  background: #ebf8ff;
}

.word.deletable {
  cursor: pointer;
  background: #fed7d7;
}

.word.deletable:hover {
  background: #fc8181;
  transform: scale(1.02);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.word:not(.deletable):hover {
  background: #edf2f7;
}

.input-word {
  background: #fef5e7 !important;
  min-width: 2px;
  display: inline-block;
  outline: none;
}

.input-word:focus {
  background: #fef0d9 !important;
  outline: none;
}

.status-bar {
  padding: 0.75rem 1rem;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #666;
  background: #fafafa;
}

.status-left {
  display: flex;
  gap: 1rem;
}

.loading {
  text-align: center;
  padding: 4rem;
  color: #666;
}

.message {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  padding: 1rem;
  border-radius: 8px;
  animation: slideIn 0.3s ease-out;
  z-index: 1000;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.message.success {
  background: #48bb78;
  color: white;
}

.message.error {
  background: #f56565;
  color: white;
}

.message.info {
  background: #4299e1;
  color: white;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .book-container {
    padding: 0.5rem;
  }
  
  .header {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .document {
    padding: 1rem;
  }
  
  .word {
    font-size: 1rem;
  }
}
</style>
