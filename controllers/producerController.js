import Producer from '../models/Producer.js';
import fetch from 'node-fetch';


const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Fetch actor details from TMDB
const fetchProducerFromTMDB = async (id) => {
  const response = await fetch(`${TMDB_BASE_URL}/person/${id}?api_key=${process.env.TMDB_API_KEY}&language=en-US`);
  const data = await response.json();
  return {
    name: data.name,
    gender: data.gender === 1 ? 'female' : data.gender === 2 ? 'male' : 'other',
    dateOfBirth: data.birthday || '',
    bio: data.biography || '',
    tmdbId: data.id.toString()
  };
};

// List of popular actor IDs for initial display (you can modify this list)
const popularProducerIds = [287, 819, 1136406, 73457, 17605];

export const getProducers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';

    let query = {};
    if (search) {
      query = { name: { $regex: search, $options: 'i' } };
    }

    // Fetch local Producers
    const localProducers = await Producer.find(query)
      .sort({ name: 1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const localCount = await Producer.countDocuments(query);

    let externalProducers = [];
    let totalExternalCount = 0;

    if (search) {
      // If there's a search query, fetch from TMDB
      const searchResponse = await fetch(`${TMDB_BASE_URL}/search/person?api_key=${process.env.TMDB_API_KEY}&query=${search}&page=${page}`);
      const searchData = await searchResponse.json();
      
      externalProducers = await Promise.all(searchData.results.slice(0, limit).map(async (actor) => {
        const details = await fetchProducerFromTMDB(actor.id);
        return { ...details, isExternal: true };
      }));
      totalExternalCount = searchData.total_results;
    } else if (page === 1 && localProducers.length < limit) {
      // If it's the first page and we have fewer local results than the limit, fetch popular Producers
      const remainingSlots = limit - localProducers.length;
      externalProducers = await Promise.all(popularActorIds.slice(0, remainingSlots).map(async (id) => {
        const details = await fetchProducerFromTMDB(id);
        return { ...details, isExternal: true };
      }));
      totalExternalCount = popularProducerIds.length;
    }

    const combinedProducers = [...localProducers, ...externalProducers];
    const totalCount = localCount + totalExternalCount;

    res.json({
      data: combinedProducers,
      page,
      pages: Math.ceil(totalCount / limit),
      total: totalCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProducerById = async (req, res) => {
  try {
    const producer = await Producer.findById(req.params.id);
    if (producer) {
      res.json(producer);
    } else {
      // If not found locally, try to fetch from TMDB
      try {
        const externalProducer = await fetchProducerFromTMDB(req.params.id);
        res.json({ ...externalProducer, isExternal: true });
      } catch (tmdbError) {
        res.status(404).json({ message: 'Producer not found' });
      }
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createProducer = async (req, res) => {
  const producer = new Producer(req.body);
  try {
    const newActor = await producer.save();
    res.status(201).json(newActor);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateProducer = async (req, res) => {
  try {
    const updatedProducer = await Actor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedProducer) return res.status(404).json({ message: 'Actor not found' });
    res.json(updatedOProducer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteProducer= async (req, res) => {
  try {
    const producer = await Producer.findByIdAndDelete(req.params.id);
    if (!producer) return res.status(404).json({ message: 'Actor not found' });
    res.json({ message: 'Actor deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

