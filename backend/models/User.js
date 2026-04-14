import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  wordsWritten: {
    type: Number,
    default: 0
  },
  deleteCredits: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Fix 1: Use regular function syntax and handle next correctly
userSchema.pre('save', async function() {
  // Only hash the password if it's modified
  if (!this.isModified('password')) {
    return;
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw new Error(`Password hashing failed: ${error.message}`);
  }
});

// Fix 2: Alternative simpler version without try-catch
// userSchema.pre('save', async function(next) {
//   if (!this.isModified('password')) return next();
//   
//   this.password = await bcrypt.hash(this.password, 10);
//   next();
// });

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
