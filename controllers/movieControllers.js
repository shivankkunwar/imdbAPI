import Movie from '../models/Movie.js';
import fetch from 'node-fetch';
import mongoose from 'mongoose';
import Producer from '../models/Producer.js';
import Actor from '../models/Actor.js';
const popularMovieIds = [
  299536, 284054, 383498, 351286, 335984, 
  447332, 493922, 260513, 348350, 345940,
  299534, 301528, 420818, 385128, 619264,
  508947, 337404, 458156, 438631, 566525
];



const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const fetchTMDBMovie = async (id) => {
  const [movieResponse, creditsResponse] = await Promise.all([
    fetch(`${TMDB_BASE_URL}/movie/${id}?api_key=${process.env.TMDB_API_KEY}&language=en-US`),
    fetch(`${TMDB_BASE_URL}/movie/${id}/credits?api_key=${process.env.TMDB_API_KEY}`)
  ]);
  const movieData = await movieResponse.json();
  const creditsData = await creditsResponse.json();
 
  return {
    name: movieData.title,
    yearOfRelease: new Date(movieData.release_date).getFullYear(),
    poster: `https://image.tmdb.org/t/p/w500${movieData.poster_path}`,
    plot: movieData.overview,
    isExternal: true,
    externalId: movieData.id.toString(),
    producer: creditsData.crew.find(person => person.job === "Producer")|| 'Unknown',
    actors: creditsData.cast.slice(0, 5).map(actor => ({
      name: actor.name,
      character: actor.character,
      tmdbId: actor.id.toString()
    }))
  };
};

const searchTMDBMovies = async (query, page) => {
  const response = await fetch(`${TMDB_BASE_URL}/search/movie?api_key=${process.env.TMDB_API_KEY}&language=en-US&query=${query}&page=${page}`);
  const data = await response.json();
  return {
    movies: await Promise.all(data.results.map(async (movie) => {
      const details = await fetchTMDBMovie(movie.id);
      return details;
    })),
    totalResults: data.total_results,
    totalPages: data.total_pages
  };
};
export const getMovies = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';

    let query = {};
    if (search) {
      query = { name: { $regex: search, $options: 'i' } };
    }

    // Get total count of local movies
    const totalLocalCount = await Movie.countDocuments(query);
    
    // Calculate if we need external results
    const totalLocalPages = Math.ceil(totalLocalCount / limit);
    const isWithinLocalPages = page <= totalLocalPages;
    
    let localMovies = [];
    let externalMovies = [];
    let totalExternalCount = 0;

    // Fetch local movies if we're within local pages
    if (isWithinLocalPages) {
      const localSkip = (page - 1) * limit;
      localMovies = await Movie.find(query)
        .populate('producer', 'name')
        .populate('actors', 'name')
        .sort({ createdAt: -1 })
        .skip(localSkip)
        .limit(limit);
    }

    // Calculate if we need external movies to fill the page
    const remainingInPage = limit - localMovies.length;

    if (remainingInPage > 0) {
      // Calculate the effective external page
      const localItemsBeforePage = (page - 1) * limit;
      const externalSkip = Math.max(0, localItemsBeforePage - totalLocalCount);
      const externalPage = Math.floor(externalSkip / limit) + 1;

      if (search) {
        // Search TMDB
        const searchResults = await searchTMDBMovies(search, externalPage);
        const startIdx = externalSkip % limit;
        externalMovies = searchResults.movies
          .slice(startIdx, startIdx + remainingInPage);
        totalExternalCount = searchResults.totalResults;
      } else {
        // Get popular movies from TMDB
        const startIdx = externalSkip;
        if (startIdx < popularMovieIds.length) {
          const pageMovieIds = popularMovieIds
            .slice(startIdx, startIdx + remainingInPage);
          
          const fetchedMovies = await Promise.all(
            pageMovieIds.map(async (id) => {
              try {
                return await fetchTMDBMovie(id);
              } catch (error) {
                console.error(`Failed to fetch TMDB movie ${id}:`, error);
                return null;
              }
            })
          );
          
          externalMovies = fetchedMovies.filter(movie => movie !== null);
          totalExternalCount = popularMovieIds.length;
        }
      }
    }

    // Combine results
    const combinedMovies = [...localMovies, ...externalMovies];
    
    // Calculate total pages based on both local and external results
    const totalCount = totalLocalCount + totalExternalCount;
    const totalPages = Math.ceil(totalCount / limit);

    // Debug information
    console.log({
      page,
      totalLocalCount,
      totalExternalCount,
      localMoviesLength: localMovies.length,
      externalMoviesLength: externalMovies.length,
      combinedLength: combinedMovies.length
    });

    res.json({
      data: combinedMovies,
      page,
      pages: totalPages,
      total: totalCount,
      localCount: totalLocalCount,
      externalCount: totalExternalCount
    });

  } catch (error) {
    console.error('Error in getMovies:', error);
    res.status(500).json({ message: error.message });
  }
};


export const searchMovies = async (req, res) => {
  try {
    const { query = '' } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Search local database
    const localQuery = {
      name: { $regex: query, $options: 'i' }
    };

    const [localMovies, localCount] = await Promise.all([
      Movie.find(localQuery)
        .populate('producer', 'name')
        .populate('actors', 'name')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Movie.countDocuments(localQuery)
    ]);

    // Search TMDB
    let externalMovies = [];
    let totalExternalResults = 0;

    if (localMovies.length < limit) {
      const remainingLimit = limit - localMovies.length;
      const externalPage = Math.ceil((skip + 1) / limit);
      
      const tmdbResponse = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=${externalPage}&include_adult=false`
      );
      const tmdbData = await tmdbResponse.json();
      
      if (tmdbData.results?.length > 0) {
        const processedMovies = await Promise.all(
          tmdbData.results.slice(0, remainingLimit).map(async (movie) => ({
            name: movie.title,
            yearOfRelease: new Date(movie.release_date).getFullYear(),
            poster: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
            plot: movie.overview,
            isExternal: true,
            externalId: movie.id.toString(),
            producer: { name: 'Unknown' },
            actors: []
          }))
        );
        externalMovies = processedMovies;
        totalExternalResults = tmdbData.total_results;
      }
    }

    const combinedMovies = [...localMovies, ...externalMovies];
    const totalResults = localCount + totalExternalResults;
    const totalPages = Math.ceil(totalResults / limit);

    res.json({
      data: combinedMovies,
      page,
      pages: totalPages,
      total: totalResults
    });
  } catch (error) {
    console.error('Error in searchMovies:', error);
    res.status(500).json({ message: 'An error occurred while searching for movies' });
  }
};
export const getMovieById = async (req, res) => {
  try {
    const { id } = req.params;
    const isValidObjectId = mongoose.Types.ObjectId.isValid(id);

    let movie = null;
    if (isValidObjectId) {
     
      movie = await Movie.findById(id)
        .populate('producer', 'name gender dateOfBirth bio')
        .populate('actors', 'name gender dateOfBirth bio');
    }
    if (movie) {
      res.json(movie);
    } else {
      // Fetch from TMDB if not found locally
      try {
        const externalMovie = await fetchTMDBMovie(req.params.id);
        res.json(externalMovie);
      } catch (tmdbError) {
        res.status(404).json({ message: 'Movie not found' });
      }
    }
  
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createMovie = async (req, res) => {
  try {
    const { name, yearOfRelease, plot, poster, producer, actors } = req.body;

    // Handle external producer
    let producerId = producer;
    if (typeof producer === 'object' && producer.isExternal) {
      // Create a new producer from external data
      const newProducer = new Producer({
        name: producer.name,
        gender: producer.gender,
        dateOfBirth: producer.dateOfBirth,
        bio: producer.bio,
        externalId: producer.tmdbId
      });
      const savedProducer = await newProducer.save();
      producerId = savedProducer._id;
    }

    // Handle external actors
    const actorIds = await Promise.all(actors.map(async (actor) => {
      if (typeof actor === 'object' && actor.isExternal) {
        // Create a new actor from external data
        const newActor = new Actor({
          name: actor.name,
          gender: actor.gender,
          dateOfBirth: actor.dateOfBirth,
          bio: actor.bio,
          externalId: actor.tmdbId
        });
        const savedActor = await newActor.save();
        return savedActor._id;
      }
      return actor;
    }));

    const movie = await Movie.create({
      name,
      yearOfRelease,
      plot,
      poster,
      producer: producerId,
      actors: actorIds
    });

    const populatedMovie = await Movie.findById(movie._id)
      .populate('producer', 'name')
      .populate('actors', 'name');

    res.status(201).json(populatedMovie);
  } catch (error) {
    console.error('Error creating movie:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateMovie = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    if (movie.isExternal) {
      return res.status(400).json({ message: 'Cannot update external movie' });
    }

    const { producer, actors, ...otherFields } = req.body;

    // Handle external producer
    let producerId = producer;
    if (typeof producer === 'object' && producer.isExternal) {
      const newProducer = new Producer({
        name: producer.name,
        gender: producer.gender,
        dateOfBirth: producer.dateOfBirth,
        bio: producer.bio,
        externalId: producer.tmdbId
      });
      const savedProducer = await newProducer.save();
      producerId = savedProducer._id;
    }

    // Handle external actors
    const actorIds = actors ? await Promise.all(actors.map(async (actor) => {
      if (typeof actor === 'object' && actor.isExternal) {
        const newActor = new Actor({
          name: actor.name,
          gender: actor.gender,
          dateOfBirth: actor.dateOfBirth,
          bio: actor.bio,
          externalId: actor.tmdbId
        });
        const savedActor = await newActor.save();
        return savedActor._id;
      }
      return actor;
    })) : movie.actors;

    const updatedMovie = await Movie.findByIdAndUpdate(
      req.params.id,
      {
        ...otherFields,
        producer: producerId || movie.producer,
        actors: actorIds
      },
      { new: true }
    )
    .populate('producer', 'name')
    .populate('actors', 'name');

    res.json(updatedMovie);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const deleteMovie = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);

    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    if (movie.isExternal) {
      return res.status(400).json({ message: 'Cannot delete external movie' });
    }

    await movie.remove();
    res.json({ message: 'Movie removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};