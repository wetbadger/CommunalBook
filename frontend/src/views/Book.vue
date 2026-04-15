<template>
  <div class="book-container">
    <header class="header">
      <div class="header-left">
        <h1>📖 Collaborative Book</h1>
        <div class="stats">
          <span>✍️ {{ authStore.wordsWritten }} words</span>
          <span>🗑️ {{ authStore.deleteCredits === 'unlimited' ? '∞' : authStore.deleteCredits }} credits</span>
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
          :disabled="!isAdmin && authStore.deleteCredits === 0"
        >
          🗑️ Delete Mode ({{ authStore.deleteCredits === 'unlimited' ? '∞' : authStore.deleteCredits }} credits)
        </button>
        <button v-if="deleteMode" @click="cancelDeleteMode" class="cancel-btn">
          Cancel Delete Mode
        </button>
        
        <!-- Admin Delete All Words Button -->
        <button 
          v-if="isAdmin" 
          @click="confirmDeleteAllWords" 
          class="admin-delete-all-btn"
          :disabled="bookStore.wordCount === 0"
        >
          ⚠️ Delete All Words
        </button>
        
        <button v-if="activeInsertPosition !== null" @click="cancelInsertMode" class="cancel-btn">
          Cancel Insert Mode
        </button>
        
        <div class="info" v-if="deleteMode">
          Click on any word (not yours) to delete it (costs 1 credit)
        </div>
        <div class="insert-info" v-if="activeInsertPosition !== null">
          📍 Inserting at position {{ activeInsertPosition }}. Type your word and press Enter/Space
        </div>
        <div class="admin-info" v-if="isAdmin">
          🔧 Admin Mode: Unlimited delete credits
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
            <!-- Insert at beginning -->
            <span 
              v-if="!deleteMode && activeInsertPosition !== 0" 
              class="insert-indicator insert-beginning"
              @click.stop="activateInsertAt(0)"
              title="Insert at beginning"
            >
              ⬅️ Insert here
            </span>
            
            <template v-for="word in bookStore.words" :key="word.id">
              <!-- Inline input component at specific position -->
              <WordInput
                v-if="activeInsertPosition === word.position"
                mode="inline"
                :insert-position="word.position"
                :is-active="true"
                :auto-focus="true"
                @submit="handleWordSubmit"
                @cancel="cancelInlineInsert"
              />
              
              <!-- Regular word -->
              <span
                class="word"
                :class="{ 
                  'deletable': deleteMode && (isAdmin || word.author !== authStore.currentUser?.id),
                  'own-word': word.author === authStore.currentUser?.id
                }"
                @click="handleWordClick($event, word)"
                @mouseenter="showTooltip($event, word)"
                @mouseleave="hideTooltip"
              >
                {{ word.text }}
              </span>
              
              <!-- Insert indicator between words -->
        <!-- And for the between indicator -->
        <span 
          v-if="!deleteMode && activeInsertPosition !== word.position + 1" 
          class="insert-indicator insert-between"
          @click.stop="activateInsertAt(word.position + 1)"
          :title="`Insert after '${word.text}'`"
        >
          ➕
        </span>
            </template>
            
            <!-- Inline input at the end -->
            <WordInput
              v-if="activeInsertPosition === bookStore.wordCount"
              mode="inline"
              :insert-position="bookStore.wordCount"
              :is-active="true"
              :auto-focus="true"
              @submit="handleWordSubmit"
              @cancel="cancelInlineInsert"
            />
            
            <!-- Insert at end indicator -->
            <span 
              v-if="!deleteMode && activeInsertPosition !== bookStore.wordCount" 
              class="insert-indicator insert-end"
              @click.stop="activateInsertAt(bookStore.wordCount)"
              title="Insert at end"
            >
              Insert here ➡️
            </span>
            
            <!-- Fallback input component -->
            <WordInput
              v-if="activeInsertPosition === null"
              ref="fallbackInput"
              mode="fallback"
              :is-active="true"
              :auto-focus="true"
              @submit="handleWordSubmit"
              @cancel="handleFallbackCancel"
            />
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

    <!-- Confirmation Modal -->
    <div v-if="showConfirmModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <h3>⚠️ Delete All Words</h3>
        <p>Are you sure you want to delete all {{ bookStore.wordCount }} words?</p>
        <p class="warning">This action cannot be undone!</p>
        <div class="modal-buttons">
          <button @click="deleteAllWords" class="confirm-delete-btn">Yes, Delete All</button>
          <button @click="closeModal" class="cancel-modal-btn">Cancel</button>
        </div>
      </div>
    </div>

    <div v-if="message" class="message" :class="messageType">
      {{ message }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useBookStore } from '../stores/book'
import WordInput from '../components/WordInput.vue'
import { io } from 'socket.io-client'

const socket = io('http://localhost:3000')
const router = useRouter()
const authStore = useAuthStore()
const bookStore = useBookStore()

const deleteMode = ref(false)
const activeInsertPosition = ref(null)
const fallbackInput = ref(null)
const message = ref('')
const messageType = ref('info')
const showConfirmModal = ref(false)
const activeUsers = ref(1)
const saving = ref(false)
let messageTimeout = null
let isProcessingRemoteUpdate = false

const isAdmin = computed(() => authStore.currentUser?.username === 'admin')

const showMessage = (text, type = 'info') => {
  if (messageTimeout) clearTimeout(messageTimeout)
  message.value = text
  messageType.value = type
  messageTimeout = setTimeout(() => {
    message.value = ''
  }, 3000)
}

const activateInsertAt = (position) => {
  console.log('activateInsertAt called with position:', position)
  console.log('Current deleteMode:', deleteMode.value)
  
  if (deleteMode.value) {
    showMessage('Please exit delete mode first', 'error')
    return
  }
  
  // Prevent if already active at same position
  if (activeInsertPosition.value === position) {
    console.log('Already active at this position')
    return
  }
  
  activeInsertPosition.value = position
  console.log('activeInsertPosition set to:', position)
  showMessage(`Insert mode active at position ${position}. Type your word.`, 'info')
}

const cancelInlineInsert = () => {
  console.log('cancelInlineInsert called, current position:', activeInsertPosition.value)
  activeInsertPosition.value = null
  showMessage('Insert mode cancelled', 'info')
}

const cancelInsertMode = () => {
  console.log('cancelInsertMode called from toolbar')
  cancelInlineInsert()
}

const handleWordSubmit = async ({ text, position }) => {
  console.log('handleWordSubmit called with:', { text, position })
  saving.value = true
  
  const result = await bookStore.addWord(text, position)
  
  saving.value = false
  
  if (result.success) {
    await authStore.fetchUserStats()
    
    if (position !== null) {
      // Inline insert
      activeInsertPosition.value = null
      console.log('Insert successful, cleared activeInsertPosition')
      showMessage(`Added "${text}" at position ${position}!`, 'success')
    } else {
      // Fallback append
      showMessage(`Added "${text}"!`, 'success')
    }
  } else {
    showMessage(result.message, 'error')
  }
}

const handleFallbackCancel = () => {
  console.log('Fallback input cancelled')
}

const enableDeleteMode = () => {
  if (isAdmin.value || authStore.deleteCredits > 0) {
    deleteMode.value = true
    showMessage('Delete mode activated!', 'info')
  } else {
    showMessage('No delete credits available!', 'error')
  }
}

const cancelDeleteMode = () => {
  deleteMode.value = false
  showMessage('Delete mode deactivated', 'info')
}

const confirmDeleteAllWords = () => {
  if (bookStore.wordCount === 0) {
    showMessage('No words to delete', 'error')
    return
  }
  showConfirmModal.value = true
}

const closeModal = () => {
  showConfirmModal.value = false
}

const deleteAllWords = async () => {
  showConfirmModal.value = false
  saving.value = true
  
  const result = await bookStore.deleteAllWords()
  
  saving.value = false
  
  if (result.success) {
    showMessage(`Successfully deleted all ${result.deletedCount} words!`, 'success')
    cancelDeleteMode()
    await authStore.fetchUserStats()
  } else {
    showMessage(result.message, 'error')
  }
}

const handleWordClick = async (event, word) => {
  if (!deleteMode.value) return
  
  event.preventDefault()
  event.stopPropagation()
  
  if (!isAdmin.value && word.author === authStore.currentUser?.id) {
    showMessage("You can't delete your own words!", 'error')
    return
  }
  
  if (!isAdmin.value && authStore.deleteCredits === 0) {
    showMessage("No delete credits available!", 'error')
    deleteMode.value = false
    return
  }
  
  if (confirm(`Delete "${word.text}"?`)) {
    saving.value = true
    
    const result = await bookStore.deleteWord(word.position)
    
    saving.value = false
    
    if (result.success) {
      showMessage(`"${word.text}" deleted!`, 'success')
      if (!isAdmin.value) {
        await authStore.fetchUserStats()
        if (authStore.deleteCredits === 0) {
          deleteMode.value = false
        }
      }
    } else {
      showMessage(result.message, 'error')
    }
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

// Socket.io handlers
socket.on('word-update', async () => {
  if (!isProcessingRemoteUpdate) {
    isProcessingRemoteUpdate = true
    await bookStore.fetchWords()
    isProcessingRemoteUpdate = false
  }
})

socket.on('word-deleted', async () => {
  if (!isProcessingRemoteUpdate) {
    isProcessingRemoteUpdate = true
    await bookStore.fetchWords()
    isProcessingRemoteUpdate = false
  }
})

onMounted(async () => {
  await bookStore.fetchWords()
  await authStore.fetchUserStats()
})

onUnmounted(() => {
  if (messageTimeout) clearTimeout(messageTimeout)
  // Clean up socket listeners
  socket.off('word-update')
  socket.off('word-deleted')
})
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

.admin-delete-all-btn {
  background: #e53e3e !important;
  font-weight: bold;
}

.admin-delete-all-btn:hover:not(:disabled) {
  background: #c53030 !important;
}

.admin-delete-all-btn:disabled {
  background: #fc8181 !important;
}

.info {
  font-size: 0.875rem;
  color: #e53e3e;
}

.admin-info {
  font-size: 0.875rem;
  color: #38a169;
  font-weight: bold;
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

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.modal-content h3 {
  margin: 0 0 1rem 0;
  color: #e53e3e;
}

.modal-content p {
  margin: 0.5rem 0;
}

.modal-content .warning {
  color: #e53e3e;
  font-weight: bold;
}

.modal-buttons {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.confirm-delete-btn {
  background: #e53e3e;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 5px;
  cursor: pointer;
  flex: 1;
}

.confirm-delete-btn:hover {
  background: #c53030;
}

.cancel-modal-btn {
  background: #718096;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 5px;
  cursor: pointer;
  flex: 1;
}

.cancel-modal-btn:hover {
  background: #4a5568;
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

/* ... (keep all your existing styles) ... */

/* Add these new styles */
/* Keep all your existing styles, plus: */
.insert-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0 0.25rem;
  cursor: pointer;
  opacity: 0.4;
  transition: all 0.2s;
  font-size: 0.8rem;
  padding: 0 0.25rem;
  border-radius: 3px;
  width: 20px;
  height: 20px;
}

.insert-indicator:hover {
  opacity: 1;
  background: #4299e1;
  color: white;
  transform: scale(1.1);
}

.insert-beginning, .insert-end {
  width: auto;
  font-size: 0.7rem;
  padding: 0.125rem 0.25rem;
}

.insert-between {
  font-size: 0.7rem;
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
}
</style>
