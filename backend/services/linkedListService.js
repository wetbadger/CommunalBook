// backend/services/linkedListService.js
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

  // Get entire book in order (no position numbers needed anymore)
  async getBookInOrder() {
    const allWords = await Word.find().lean();
    const wordMap = new Map();
    allWords.forEach(word => wordMap.set(word._id.toString(), word));
    
    const orderedWords = [];
    let current = await this.getHead();
    let maxIterations = 10000;
    let iterations = 0;
    
    while (current && iterations < maxIterations) {
      orderedWords.push(current.toObject ? current.toObject() : current);
      
      if (current.nextWord) {
        current = wordMap.get(current.nextWord.toString());
      } else {
        current = null;
      }
      iterations++;
    }
    
    return orderedWords;
  }

  // Insert after a specific word (by ID)
  async insertWordAfter(wordData, afterWordId) {
    try {
      const newWord = new Word(wordData);
      
      if (afterWordId === null) {
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
        // Insert after specific word
        const afterWord = await Word.findById(afterWordId);
        if (!afterWord) {
          throw new Error('Reference word not found');
        }
        
        newWord.prevWord = afterWord._id;
        newWord.nextWord = afterWord.nextWord;
        
        // Update the next word's prev pointer
        if (afterWord.nextWord) {
          const nextWord = await Word.findById(afterWord.nextWord);
          if (nextWord) {
            nextWord.prevWord = newWord._id;
            await nextWord.save();
          }
        }
        
        // Update the after word's next pointer
        afterWord.nextWord = newWord._id;
        await afterWord.save();
        await newWord.save();
      }
      
      return newWord;
    } catch (error) {
      console.error('Error inserting word:', error);
      throw error;
    }
  }

  // Insert before a specific word (by ID)
  async insertWordBefore(wordData, beforeWordId) {
    try {
      const newWord = new Word(wordData);
      const beforeWord = await Word.findById(beforeWordId);
      
      if (!beforeWord) {
        throw new Error('Reference word not found');
      }
      
      newWord.prevWord = beforeWord.prevWord;
      newWord.nextWord = beforeWord._id;
      
      // Update the previous word's next pointer
      if (beforeWord.prevWord) {
        const prevWord = await Word.findById(beforeWord.prevWord);
        if (prevWord) {
          prevWord.nextWord = newWord._id;
          await prevWord.save();
        }
      }
      
      // Update the before word's prev pointer
      beforeWord.prevWord = newWord._id;
      await beforeWord.save();
      await newWord.save();
      
      return newWord;
    } catch (error) {
      console.error('Error inserting word:', error);
      throw error;
    }
  }

  // Append to end
  async appendWord(wordData) {
    try {
      const newWord = new Word(wordData);
      const tail = await this.getTail();
      
      if (tail) {
        newWord.prevWord = tail._id;
        tail.nextWord = newWord._id;
        await tail.save();
      }
      newWord.nextWord = null;
      
      await newWord.save();
      return newWord;
    } catch (error) {
      console.error('Error appending word:', error);
      throw error;
    }
  }

  // Delete word by ID
  async deleteWordById(wordId) {
    try {
      const wordToDelete = await Word.findById(wordId);
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
      return true;
    } catch (error) {
      console.error('Error deleting word:', error);
      throw error;
    }
  }

  // Get word count efficiently
  async getWordCount() {
    return await Word.countDocuments();
  }

  // Get word by ID with context (neighbors)
  async getWordWithContext(wordId) {
    const word = await Word.findById(wordId);
    if (!word) return null;
    
    let prevWord = null;
    let nextWord = null;
    
    if (word.prevWord) {
      prevWord = await Word.findById(word.prevWord);
    }
    if (word.nextWord) {
      nextWord = await Word.findById(word.nextWord);
    }
    
    return {
      word,
      prevWord,
      nextWord
    };
  }
}

export default new LinkedListService();