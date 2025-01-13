import Actor from '../models/Actor.js';
import fetch from 'node-fetch';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Fetch actor details from TMDB
const fetchActorFromTMDB = async (id) => {
  const response = await fetch(`${TMDB_BASE_URL}/person/${id}?api_key=${TMDB_API_KEY}&language=en-US`);
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
const popularActorIds = [287, 819, 1136406, 73457, 17605];

export const getActors = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';

    let query = {};
    if (search) {
      query = { name: { $regex: search, $options: 'i' } };
    }

    // Fetch local actors
    const localActors = await Actor.find(query)
      .sort({ name: 1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const localCount = await Actor.countDocuments(query);

    let externalActors = [];
    let totalExternalCount = 0;

    if (search) {
      // If there's a search query, fetch from TMDB
      const searchResponse = await fetch(`${TMDB_BASE_URL}/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(search)}&page=${page}`);
      const searchData = await searchResponse.json();
      
      externalActors = await Promise.all(searchData.results.slice(0, limit).map(async (actor) => {
        const details = await fetchActorFromTMDB(actor.id);
        return { ...details, isExternal: true };
      }));
      totalExternalCount = searchData.total_results;
    } else if (page === 1 && localActors.length < limit) {
      // If it's the first page and we have fewer local results than the limit, fetch popular actors
      const remainingSlots = limit - localActors.length;
      externalActors = await Promise.all(popularActorIds.slice(0, remainingSlots).map(async (id) => {
        const details = await fetchActorFromTMDB(id);
        return { ...details, isExternal: true };
      }));
      totalExternalCount = popularActorIds.length;
    }

    const combinedActors = [...localActors, ...externalActors];
    const totalCount = localCount + totalExternalCount;

    res.json({
      data: combinedActors,
      page,
      pages: Math.ceil(totalCount / limit),
      total: totalCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getActorById = async (req, res) => {
  try {
    const actor = await Actor.findById(req.params.id);
    if (actor) {
      res.json(actor);
    } else {
      // If not found locally, try to fetch from TMDB
      try {
        const externalActor = await fetchActorFromTMDB(req.params.id);
        res.json({ ...externalActor, isExternal: true });
      } catch (tmdbError) {
        res.status(404).json({ message: 'Actor not found' });
      }
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createActor = async (req, res) => {
  const actor = new Actor(req.body);
  try {
    const newActor = await actor.save();
    res.status(201).json(newActor);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateActor = async (req, res) => {
  try {
    const updatedActor = await Actor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedActor) return res.status(404).json({ message: 'Actor not found' });
    res.json(updatedActor);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteActor = async (req, res) => {
  try {
    const actor = await Actor.findByIdAndDelete(req.params.id);
    if (!actor) return res.status(404).json({ message: 'Actor not found' });
    res.json({ message: 'Actor deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

