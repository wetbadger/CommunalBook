<template>
  <div class="book-container" :class="{ 'deleting-active': deletionLock || bookStore.isDeleting }">
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
        
        <button 
          v-if="isAdmin" 
          @click="confirmDeleteAllWords" 
          class="admin-delete-all-btn"
          :disabled="bookStore.wordCount === 0"
        >
          ⚠️ Delete All Words
        </button>
        
        <button v-if="activeInsertMode" @click="cancelInsertMode" class="cancel-btn">
          Cancel Insert Mode
        </button>
        
        <div class="info" v-if="deleteMode">
          Click on any word (not yours) to delete it
        </div>
        <div class="insert-info" v-if="activeInsertMode && activeInsertRefWord">
          📍 Inserting {{ activeInsertMode === 'after' ? 'after' : 'before' }} "{{ activeInsertRefWord.text }}". Type your word and press Enter/Space
        </div>
        <div class="insert-info" v-if="activeInsertMode && !activeInsertRefWord">
          📍 Inserting at {{ activeInsertMode === 'after' ? 'end' : 'beginning' }}. Type your word and press Enter/Space
        </div>
        <div class="admin-info" v-if="isAdmin">
          🔧 Admin Mode: Unlimited delete credits
        </div>
        
        <div v-if="bookStore.isAdding || isAddingWord" class="status-indicator">
          Adding word...
        </div>
        <div v-if="bookStore.isLiking || isLikingWord" class="status-indicator">
          Processing like...
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
            <!-- Insert at beginning indicator - only show when not in insert mode -->
            <span 
              v-if="!deleteMode && activeInsertMode !== 'before' && !insertingAtBeginning" 
              class="insert-indicator insert-beginning"
              @click.stop="activateInsertBefore(null)"
              title="Insert at beginning"
            >
              ➕
            </span>
                        
            <!-- Insert before input (at beginning) -->
            <WordInput
              v-if="activeInsertMode === 'before' && activeInsertRefWord === null"
              key="insert-beginning"
              mode="inline"
              :is-active="true"
              :auto-focus="true"
              @submit="handleWordSubmit"
              @cancel="cancelInsertMode"
            />
            
            <template v-for="word in bookStore.words" :key="word._id">
              <!-- Insert before this word input -->
              <WordInput
                v-if="activeInsertMode === 'before' && activeInsertRefWord?._id === word._id"
                :key="`before-${word._id}`"
                mode="inline"
                :is-active="true"
                :auto-focus="true"
                @submit="handleWordSubmit"
                @cancel="cancelInsertMode"
              />
              
              <!-- Regular word -->
              <span
                class="word"
                :class="{ 
                  'deletable': deleteMode && (isAdmin || word.author !== authStore.currentUser?.id),
                  'own-word': word.author === authStore.currentUser?.id,
                  'high-cost': deleteMode && word.deletionCost && word.deletionCost >= 100,
                  'medium-cost': deleteMode && word.deletionCost && word.deletionCost >= 10 && word.deletionCost < 100,
                  'deleting': pendingDeletion === word._id
                }"
                @click="handleWordClick($event, word)"
                @mouseenter="showTooltip($event, word)"
                @mouseleave="hideTooltip"
              >
                {{ word.text }}
                <span class="like-button" @click.stop="toggleLike(word)">
                  {{ word.userLiked ? '❤️' : '🤍' }}
                </span>
                <span v-if="deleteMode && word.deletionCost && !isAdmin && word.author !== authStore.currentUser?.id" 
                      class="delete-cost"
                      :class="{
                        'cost-high': word.deletionCost >= 100,
                        'cost-medium': word.deletionCost >= 10 && word.deletionCost < 100
                      }">
                  {{ word.deletionCost }}
                </span>
              </span>
              
              <!-- Insert after this word indicator - only show when not in insert mode for this position -->
              <span 
                v-if="!deleteMode && !(activeInsertRefWord?._id === word._id)" 
                class="insert-indicator insert-between"
                @click.stop="activateInsertAfter(word)"
                :title="`Insert after '${word.text}'`"
              >
                ➕
              </span>
              
              <!-- Insert after this word input -->
              <WordInput
                v-if="activeInsertMode === 'after' && activeInsertRefWord?._id === word._id"
                :key="`after-${word._id}`"
                mode="inline"
                :is-active="true"
                :auto-focus="true"
                @submit="handleWordSubmit"
                @cancel="cancelInsertMode"
              />
            </template>
            
            <!-- Insert at end input -->
            <WordInput
              v-if="activeInsertMode === 'after' && activeInsertRefWord === null"
              key="insert-end"
              mode="inline"
              :is-active="true"
              :auto-focus="true"
              @submit="handleWordSubmit"
              @cancel="cancelInsertMode"
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

    <!-- Rest of your modals and messages... -->
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
    
    <div v-if="deletionLock || bookStore.isDeleting" class="delete-overlay">
      <div class="delete-spinner">🗑️ Deleting...</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useBookStore } from '../stores/book'
import { io } from 'socket.io-client'
import WordInput from '../components/WordInput.vue'

const socket = io('http://localhost:3000')
const router = useRouter()
const authStore = useAuthStore()
const bookStore = useBookStore()

const deleteMode = ref(false)
const activeInsertMode = ref(null) // 'before', 'after', or null
const activeInsertRefWord = ref(null) // The word to insert before/after (null means beginning or end)
const message = ref('')
const messageType = ref('info')
const showConfirmModal = ref(false)
const activeUsers = ref(1)
const saving = ref(false)
const pendingDeletion = ref(null)
const deletionLock = ref(false)
const isAddingWord = ref(false)
const isLikingWord = ref(false)
const insertingAtBeginning = ref(false)
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

const activateInsertAfter = (word) => {
  if (deleteMode.value) {
    showMessage('Please exit delete mode first', 'error')
    return
  }
  
  activeInsertMode.value = 'after'
  activeInsertRefWord.value = word
  showMessage(word ? `Insert mode active after "${word.text}"` : 'Insert mode active at end', 'info')
}

const activateInsertBefore = (word) => {
  if (deleteMode.value) {
    showMessage('Please exit delete mode first', 'error')
    return
  }
  
  // Only allow insert at beginning
  if (word) {
    showMessage('Insert before mode only works at the beginning. Use insert after for other positions.', 'warning')
    return
  }
  
  const firstWord = bookStore.words[0]
  if (firstWord) {
    activeInsertRefWord.value = firstWord
    activeInsertMode.value = 'before'
    showMessage(`Insert mode active at beginning (before "${firstWord.text}")`, 'info')
  } else {
    // Book is empty, just use after mode
    activeInsertMode.value = 'after'
    activeInsertRefWord.value = null
    showMessage('Book is empty, will add first word', 'info')
  }
}

const cancelInsertMode = () => {
  activeInsertMode.value = null
  activeInsertRefWord.value = null
  showMessage('Insert mode cancelled', 'info')
}

// Store the word we're inserting after/before
const lastInsertedAfterWord = ref(null)

const handleWordSubmit = async ({ text }) => {
  if (isAddingWord.value || bookStore.isAdding) {
    showMessage('Please wait, already adding a word...', 'warning')
    return
  }
  
  isAddingWord.value = true
  saving.value = true
  
  // Store current insert position before clearing
  const insertBeforeThis = activeInsertRefWord.value
  const currentMode = activeInsertMode.value
  
  const options = {}
  if (currentMode === 'after') {
    options.insertAfterWordId = insertBeforeThis?._id || null
  } else if (currentMode === 'before') {
    options.insertBeforeWordId = insertBeforeThis?._id || null
  }
  
  const result = await bookStore.addWord(text, options)
  
  saving.value = false
  isAddingWord.value = false
  
  if (result.success) {
    await authStore.fetchUserStats()
    await nextTick()
    
    // For both modes, automatically switch to after mode for continuous typing
    if (currentMode === 'after') {
      // After mode: activate insert after the newly added word
      if (insertBeforeThis) {
        // Find where we added the word (after the reference word)
        const refIndex = bookStore.words.findIndex(w => w._id === insertBeforeThis._id)
        if (refIndex !== -1 && refIndex + 1 < bookStore.words.length) {
          // Activate after the word we just added
          activateInsertAfter(bookStore.words[refIndex + 1])
          showMessage(`Added "${text}"! Keep typing...`, 'success')
          return
        }
      } else if (insertBeforeThis === null) {
        // Added at the end, activate after the last word (which is the newly added word)
        const lastWord = bookStore.words[bookStore.words.length - 1]
        if (lastWord) {
          activateInsertAfter(lastWord)
          showMessage(`Added "${text}"! Keep typing...`, 'success')
          return
        }
      }
    } else if (currentMode === 'before') {
      // Before mode (only at beginning): after adding, switch to after mode
      // Activate insert after the newly added word (which is now at position 0)
      const firstWord = bookStore.words[0]
      if (firstWord) {
        activateInsertAfter(firstWord)
        showMessage(`Added "${text}" at beginning! Now adding after it...`, 'success')
        return
      }
    }
    
    // If we couldn't auto-reactivate, just cancel mode
    cancelInsertMode()
    showMessage(`Added "${text}"!`, 'success')
  } else {
    showMessage(result.message, 'error')
    cancelInsertMode()
  }
}

const cancelDeleteMode = () => {
  if (deletionLock.value || bookStore.isDeleting) {
    showMessage('Cannot exit delete mode while deletion is in progress', 'warning')
    return
  }
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
  if (!deleteMode.value || deletionLock.value || bookStore.isDeleting) {
    if (bookStore.isDeleting) {
      showMessage('Please wait, another word is being deleted...', 'warning')
    }
    return
  }
  
  event.preventDefault()
  event.stopPropagation()
  
  if (!isAdmin.value && word.author === authStore.currentUser?.id) {
    showMessage("You can't delete your own words!", 'error')
    return
  }
  
  const currentWord = bookStore.words.find(w => w._id === word._id)
  if (!currentWord) {
    showMessage('This word has already been deleted', 'warning')
    return
  }
  
  let cost = word.deletionCost
  if (!cost && !isAdmin.value) {
    const costInfo = await bookStore.getDeletionCost(word._id)
    cost = costInfo.cost
    word.deletionCost = cost
  }
  
  if (!isAdmin.value && authStore.deleteCredits < cost) {
    showMessage(`Not enough credits! This word costs ${cost} credit(s) to delete. You have ${authStore.deleteCredits} credits.`, 'error')
    return
  }
  
  const costMessage = !isAdmin.value ? ` This will cost ${cost} credit(s).` : ''
  
  if (pendingDeletion.value) {
    showMessage('Already processing a deletion request', 'warning')
    return
  }
  
  if (confirm(`Delete "${word.text}"?${costMessage}`)) {
    deletionLock.value = true
    pendingDeletion.value = word._id
    saving.value = true
    
    try {
      const result = await bookStore.deleteWordById(word._id)
      
      if (result.success) {
        showMessage(`"${word.text}" deleted! Cost: ${result.cost || cost} credit(s)`, 'success')
        
        if (!isAdmin.value) {
          await authStore.fetchUserStats()
          if (authStore.deleteCredits === 0) {
            deleteMode.value = false
            showMessage('Delete mode deactivated - no credits left', 'info')
          }
        }
        
        await updateDeletionCosts()
      } else {
        if (result.alreadyDeleted) {
          showMessage('This word has already been deleted', 'warning')
          await bookStore.fetchWords()
        } else {
          showMessage(result.message, 'error')
        }
      }
    } catch (error) {
      console.error('Delete error:', error)
      showMessage('An unexpected error occurred during deletion', 'error')
    } finally {
      deletionLock.value = false
      pendingDeletion.value = null
      saving.value = false
    }
  }
}

const updateDeletionCosts = async () => {
  if (deleteMode.value && !isAdmin.value) {
    for (const word of bookStore.words) {
      if (word.author !== authStore.currentUser?.id) {
        const costInfo = await bookStore.getDeletionCost(word._id)
        word.deletionCost = costInfo.cost
        word.deviations = costInfo.deviations
      } else {
        word.deletionCost = 0
      }
    }
  }
}

const showTooltip = async (event, word) => {
  let tooltipContent = `
    ✍️ Written by: ${word.authorName}<br>
    ❤️ Likes: ${word.likes || 0}
  `
  
  if (deleteMode.value && !isAdmin.value && word.author !== authStore.currentUser?.id) {
    let costInfo = word.deletionCost
    if (!costInfo) {
      costInfo = await bookStore.getDeletionCost(word._id)
      word.deletionCost = costInfo.cost
      word.deviations = costInfo.deviations
    }

    tooltipContent += `<br>💸 Deletion cost: ${costInfo} credit(s)`
    if (costInfo.deviations >= 1) {
      tooltipContent += `<br>📊 ${costInfo.deviations.toFixed(1)} std dev above average`
    }
  }
  
  const tooltip = document.createElement('div')
  tooltip.className = 'word-tooltip'
  tooltip.innerHTML = tooltipContent
  tooltip.style.position = 'absolute'
  tooltip.style.left = `${event.clientX + 10}px`
  tooltip.style.top = `${event.clientY - 30}px`
  tooltip.style.backgroundColor = '#2d3748'
  tooltip.style.color = 'white'
  tooltip.style.padding = '8px 12px'
  tooltip.style.borderRadius = '4px'
  tooltip.style.fontSize = '12px'
  tooltip.style.pointerEvents = 'none'
  tooltip.style.zIndex = '1000'
  tooltip.style.whiteSpace = 'nowrap'
  document.body.appendChild(tooltip)
  event.target._tooltip = tooltip
}

const enableDeleteMode = () => {
  if (deletionLock.value || bookStore.isDeleting) {
    showMessage('Please wait for current operation to complete', 'warning')
    return
  }
  
  if (isAdmin.value || authStore.deleteCredits > 0) {
    deleteMode.value = true
    updateDeletionCosts()
    showMessage('Delete mode activated! Click on any word (not yours) to delete it', 'info')
  } else {
    showMessage('No delete credits available!', 'error')
  }
}

const hideTooltip = (event) => {
  if (event.target._tooltip) {
    event.target._tooltip.remove()
  }
}

const toggleLike = async (word) => {
  if (!authStore.isAuthenticated) {
    showMessage('Please login to like words', 'error')
    return
  }
  
  if (isLikingWord.value || bookStore.isLiking) {
    showMessage('Please wait, finishing previous operation...', 'warning')
    return
  }
  
  isLikingWord.value = true
  saving.value = true
  
  let result
  if (word.userLiked) {
    result = await bookStore.unlikeWord(word._id)
    if (result.success) {
      showMessage('Like removed', 'info')
    }
  } else {
    result = await bookStore.likeWord(word._id)
    if (result.success) {
      showMessage('Word liked!', 'success')
    }
  }
  
  saving.value = false
  isLikingWord.value = false
  
  if (!result.success) {
    showMessage(result.message, 'error')
  }
}

const logout = () => {
  authStore.logout()
  router.push('/')
}

const handleKeydown = (event) => {
  if (event.key === 'Escape' && deleteMode.value) {
    cancelDeleteMode()
  }
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
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  if (messageTimeout) clearTimeout(messageTimeout)
  document.removeEventListener('keydown', handleKeydown)
  socket.off('word-update')
  socket.off('word-deleted')
})

watch(deleteMode, (newVal) => {
  if (newVal && !isAdmin.value && !deletionLock.value) {
    updateDeletionCosts()
  }
})

watch(() => bookStore.words, () => {
  if (deleteMode.value && !isAdmin.value && !deletionLock.value) {
    updateDeletionCosts()
  }
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

/* Add to the style section of Book.vue */

.word.deleting {
  opacity: 0.5;
  pointer-events: none;
  animation: pulse 0.5s ease-in-out;
}

@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.3; }
}

.delete-mode-active.deleting-active {
  cursor: wait !important;
}

.deleting-active .word {
  pointer-events: none;
}

/* Visual feedback for delete button state */
.delete-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.word {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-right: 4px;
}

.like-button {
  cursor: pointer;
  font-size: 14px;
  opacity: 0.6;
  transition: opacity 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.like-button:hover {
  opacity: 1;
  transform: scale(1.1);
}

.like-count {
  font-size: 11px;
  color: #666;
}

.word:hover .like-button {
  opacity: 1;
}

/* Add these styles for delete cost badges */
.delete-cost {
  display: inline-block;
  margin-left: 4px;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
  background-color: #ff9800;
  color: white;
}

.cost-medium {
  background-color: #ff5722;
}

.cost-high {
  background-color: #f44336;
  animation: pulse 1s infinite;
}

.high-cost {
  background-color: rgba(244, 67, 54, 0.1);
  border: 1px solid #f44336;
}

.medium-cost {
  background-color: rgba(255, 87, 34, 0.1);
  border: 1px solid #ff5722;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}

/* Add spinner animation */
.spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
  margin-left: 5px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-indicator {
  display: inline-block;
  margin-left: 10px;
  padding: 4px 8px;
  background-color: #f0f0f0;
  border-radius: 4px;
  font-size: 12px;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
