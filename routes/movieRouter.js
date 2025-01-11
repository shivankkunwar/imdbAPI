import express from 'express';
import {
  getMovies,
  getMovieById,
  createMovie,
  updateMovie,
  deleteMovie,
  searchMovies
} from '../controllers/movieControllers.js';
import auth from '../middleware/authMiddleWare.js';

const router = express.Router();

router.get('/search', auth, searchMovies);

router.route('/')
  .get(auth, getMovies)
  .post(auth, createMovie);

router.route('/:id')
  .get(auth, getMovieById)
  .put(auth, updateMovie)
  .delete(auth, deleteMovie);

export default router;