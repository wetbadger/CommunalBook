import Word from '../models/Word.js';

class LinkedListService {
  // Get the first word (head)
  async getHead() {
    return await Word.findOne({ prevWord: null }).populate('author', 'username');
  }

  // Get the last word (tail)
  async getTail() {
    return await Word.findOne({ nextWord: null }).populate('author', 'username');
  }

  // Get entire book in order
// backend/services/linkedListService.js
async getBookInOrder() {
  const allWords = await Word.find().lean();
  const wordMap = new Map();
  allWords.forEach(word => wordMap.set(word._id.toString(), word));
  
  const orderedWords = [];
  let current = await this.getHead();
  let maxIterations = 10000; // Safety limit
  let iterations = 0;
  let position = 0; // Add position counter
  
  while (current && iterations < maxIterations) {
    // Create a new object with position added
    const wordWithPosition = {
      ...current.toObject ? current.toObject() : current,
      position: position // Add the position
    };
    orderedWords.push(wordWithPosition);
    
    if (current.nextWord) {
      current = wordMap.get(current.nextWord.toString());
    } else {
      current = null;
    }
    iterations++;
    position++; // Increment position
  }
  
  return orderedWords;
}

  // Insert word at specific position (without transactions)
  async insertWordAtPosition(wordData, position) {
    try {
      const newWord = new Word(wordData);
      
      if (position === 0) {
        // Insert at beginning
        const oldHead = await this.getHead();
        newWord.nextWord = oldHead ? oldHead._id : null;
        newWord.prevWord = null;
        
        if (oldHead) {
          oldHead.prevWord = newWord._id;
          await oldHead.save();
        }
        
        await newWord.save();
      } else {
        // Insert at position or end
        const prevWord = await this.getWordByOrder(position - 1);
        
        if (prevWord) {
          newWord.prevWord = prevWord._id;
          newWord.nextWord = prevWord.nextWord;
          
          // Update next word's prev pointer
          if (prevWord.nextWord) {
            const nextWord = await Word.findById(prevWord.nextWord);
            if (nextWord) {
              nextWord.prevWord = newWord._id;
              await nextWord.save();
            }
          }
          
          prevWord.nextWord = newWord._id;
          await prevWord.save();
        } else {
          // Append to end
          const tail = await this.getTail();
          if (tail) {
            newWord.prevWord = tail._id;
            tail.nextWord = newWord._id;
            await tail.save();
          }
          newWord.nextWord = null;
        }
        
        await newWord.save();
      }
      
      // Update order numbers asynchronously (don't wait)
      this.recalculateOrders().catch(console.error);
      
      return newWord;
    } catch (error) {
      console.error('Error inserting word:', error);
      throw error;
    }
  }

  // Delete word at position (without transactions)
  async deleteWordAtPosition(position) {
    try {
      const wordToDelete = await this.getWordByOrder(position);
      if (!wordToDelete) {
        throw new Error('Word not found');
      }
      
      // Connect previous and next words
      if (wordToDelete.prevWord) {
        const prevWord = await Word.findById(wordToDelete.prevWord);
        if (prevWord) {
          prevWord.nextWord = wordToDelete.nextWord;
          await prevWord.save();
        }
      }
      
      if (wordToDelete.nextWord) {
        const nextWord = await Word.findById(wordToDelete.nextWord);
        if (nextWord) {
          nextWord.prevWord = wordToDelete.prevWord;
          await nextWord.save();
        }
      }
      
      await wordToDelete.deleteOne();
      
      // Update order numbers asynchronously
      this.recalculateOrders().catch(console.error);
      
      return true;
    } catch (error) {
      console.error('Error deleting word:', error);
      throw error;
    }
  }

  // Get word by order (using cached order field or traversal)
  async getWordByOrder(targetOrder) {
    // First try using cached order field
    const wordWithOrder = await Word.findOne({ order: targetOrder });
    if (wordWithOrder) return wordWithOrder;
    
    // Fallback to traversal
    let current = await this.getHead();
    let currentOrder = 0;
    
    while (current) {
      if (currentOrder === targetOrder) {
        return current;
      }
      current = current.nextWord ? await Word.findById(current.nextWord) : null;
      currentOrder++;
    }
    
    return null;
  }

  // Recalculate order numbers for caching
  async recalculateOrders() {
    let current = await this.getHead();
    let order = 0;
    let updates = [];
    
    while (current) {
      if (current.order !== order) {
        current.order = order;
        updates.push(current.save());
      }
      current = current.nextWord ? await Word.findById(current.nextWord) : null;
      order++;
    }
    
    await Promise.all(updates);
    console.log(`✅ Recalculated orders for ${order} words`);
  }

  // Get word count efficiently
  async getWordCount() {
    return await Word.countDocuments();
  }

  // Get range of words (for pagination)
async getWordRange(startPosition, count) {
  const startWord = await this.getWordByOrder(startPosition);
  if (!startWord) return [];
  
  const words = [];
  let current = startWord;
  let fetched = 0;
  let currentPosition = startPosition; // Track position
  let maxIterations = count * 2; // Safety limit
  
  while (current && fetched < count && fetched < maxIterations) {
    const wordWithPosition = {
      ...current.toObject ? current.toObject() : current,
      position: currentPosition
    };
    words.push(wordWithPosition);
    
    current = current.nextWord ? await Word.findById(current.nextWord) : null;
    fetched++;
    currentPosition++;
  }
  
  return words;
}

  // Get word by ID with its order
  async getWordWithOrder(wordId) {
    const word = await Word.findById(wordId);
    if (!word) return null;
    
    if (word.order !== undefined && word.order !== null) {
      return word;
    }
    
    // Calculate order if not cached
    let current = await this.getHead();
    let order = 0;
    
    while (current) {
      if (current._id.toString() === wordId) {
        word.order = order;
        await word.save();
        return word;
      }
      current = current.nextWord ? await Word.findById(current.nextWord) : null;
      order++;
    }
    
    return null;
  }
}

export default new LinkedListService();