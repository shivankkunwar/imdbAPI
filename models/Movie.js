import mongoose from 'mongoose';

const MovieSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Movie name is required"],
        trim:true
    },
    yearOfRelease: {
        type: Number,
        required: [true, 'Year of Release is required'],
        min: [ 1888, 'Year must be after 1888'],
        max: [new Date().getFullYear(), "year cannot be in the future"],
    },
    plot: {
        type: String,
        required: [true, 'Plot is required'],
        minLength: [10, 'Plot must be atleast 10 characters long']
    },
    poster: {
        type:String,
        required: [true, 'Poster URL is required']
    },
    producer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Producer',
        required: [true, "Producer is required"]
    },
    actors: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Actor'
    }],
    isExternal: {
        type: Boolean,
        default: false
    },
    externalId: {
        type: String,
        sparse: true,
        index:true
    }
},{
    timestamps: true
})

MovieSchema.index({name:1,yearOfRelease:1});
const Movie = mongoose.model('Movie', MovieSchema);
export default Movie;