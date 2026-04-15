<!-- components/WordInput.vue -->
<template>
  <span 
    ref="inputRef"
    class="word-input"
    :class="{
      'inline-mode': mode === 'inline',
      'fallback-mode': mode === 'fallback',
      'active': isActive
    }"
    contenteditable="true"
    @input="handleInput"
    @keydown="handleKeydown"
    @blur="handleBlur"
    @paste="handlePaste"
    :data-placeholder="placeholder"
  ></span>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  mode: {
    type: String,
    required: true,
    validator: (value) => ['inline', 'fallback'].includes(value)
  },
  insertPosition: {
    type: Number,
    default: null
  },
  isActive: {
    type: Boolean,
    default: false
  },
  autoFocus: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['submit', 'cancel'])

const inputRef = ref(null)
const localText = ref('')
const isMounted = ref(false)
const suppressOutsideClick = ref(false)

const placeholder = computed(() => {
  if (props.mode === 'inline' && props.insertPosition !== null) {
    return `Insert at position ${props.insertPosition}...`
  }
  return 'Type a word...'
})

// Handle click outside
const handleClickOutside = (event) => {
  // Skip if we're suppressing outside clicks (just mounted)
  if (suppressOutsideClick.value) {
    return
  }
  
  // Only handle if component is mounted and active
  if (!isMounted.value) return
  if (props.mode === 'inline' && props.isActive && inputRef.value) {
    // Check if click is outside the input element
    if (!inputRef.value.contains(event.target)) {
      if (localText.value.trim() === '') {
        console.log('Click outside, cancelling')
        cancel()
      }
    }
  }
}

// Add and remove click outside listener
onMounted(() => {
  isMounted.value = true
  
  // Suppress outside clicks for a short time to prevent the triggering click from canceling
  suppressOutsideClick.value = true
  setTimeout(() => {
    suppressOutsideClick.value = false
  }, 200)
  
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  isMounted.value = false
  document.removeEventListener('click', handleClickOutside)
})

const handleInput = (event) => {
  localText.value = event.target.textContent
  if (localText.value.includes(' ') || localText.value.includes('\n')) {
    submit()
  }
}

const handleKeydown = async (event) => {
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault()
    await submit()
    return
  }
  
  if (event.key === 'Escape') {
    event.preventDefault()
    cancel()
    return
  }
  
  // Prevent backspace when empty
  if (event.key === 'Backspace' && localText.value.length === 0) {
    event.preventDefault()
  }
}

const handleBlur = () => {
  console.log('Input blurred')
}

const handlePaste = (event) => {
  event.preventDefault()
  const text = event.clipboardData.getData('text/plain')
  const firstWord = text.trim().split(/\s+/)[0]
  if (firstWord) {
    localText.value = firstWord
    if (inputRef.value) {
      inputRef.value.textContent = firstWord
    }
    submit()
  }
}

const submit = async () => {
  const wordText = localText.value.trim()
  
  if (wordText) {
    console.log('Submitting word:', wordText)
    emit('submit', {
      text: wordText,
      position: props.insertPosition
    })
    clear()
  } else {
    cancel()
  }
}

const cancel = () => {
  console.log('Cancelling input')
  clear()
  emit('cancel')
}

const clear = () => {
  localText.value = ''
  if (inputRef.value) {
    inputRef.value.textContent = ''
  }
}

const focus = () => {
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus()
      
      // Place cursor at the end
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(inputRef.value)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  })
}

// Watch for autoFocus prop
watch(() => props.autoFocus, (shouldFocus) => {
  if (shouldFocus && props.isActive && isMounted.value) {
    focus()
  }
})

// Focus when component becomes active
watch(() => props.isActive, (active) => {
  if (active && props.autoFocus && isMounted.value) {
    focus()
  }
})

onMounted(() => {
  if (props.autoFocus && props.isActive) {
    focus()
  }
})

// Expose methods for parent component
defineExpose({
  focus,
  clear,
  getText: () => localText.value
})
</script>

<style scoped>
.word-input {
  display: inline-block;
  min-width: 60px;
  border-radius: 3px;
  transition: all 0.2s;
  outline: none;
  padding: 0.125rem 0.25rem;
}

.word-input[data-placeholder]:empty:before {
  content: attr(data-placeholder);
  color: #a0aec0;
  font-style: italic;
}

.inline-mode {
  background: #c6f6d5 !important;
  border-left: 3px solid #38a169;
  padding-left: 0.5rem !important;
  margin: 0 0.25rem;
  animation: slideIn 0.2s ease-out;
}

.fallback-mode {
  background: #fef5e7 !important;
}

.inline-mode.active {
  background: #9ae6b4 !important;
  border-left-color: #2f855a;
}

.fallback-mode.active {
  background: #fef0d9 !important;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>