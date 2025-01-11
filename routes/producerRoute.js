import express from 'express';
import {
  getProducers,
  getProducerById,
  createProducer,
  updateProducer,
  deleteProducer
} from '../controllers/producerController.js';
import auth from '../middleware/authMiddleWare.js';

const router = express.Router();

router.route('/')
  .get(auth, getProducers)
  .post(auth, createProducer);

router.route('/:id')
  .get(auth, getProducerById)
  .put(auth, updateProducer)
  .delete(auth, deleteProducer);

export default router;