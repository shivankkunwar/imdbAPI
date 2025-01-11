import mongoose from 'mongoose';

const producerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Producer name is required'],
    trim: true
  },
  gender: {
    type: String,
    required: [true, 'Gender is required'],
    enum: ['male', 'female', 'other']
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  bio: {
    type: String,
    required: [true, 'Bio is required'],
    minlength: [10, 'Bio must be at least 10 characters long']
  }
}, {
  timestamps: true
});

const Producer = mongoose.model('Producer', producerSchema);

export default Producer;