import Movie from '../models/Movie.js';
import fetch from 'node-fetch';
import mongoose from 'mongoose';

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

    // Fetch local movies
    const localMovies = await Movie.find(query)
      .populate('producer', 'name')
      .populate('actors', 'name')
      .sort({ createdAt: -1 })
      .limit(limit)  .skip((page - 1) * limit);;

    const localCount = await Movie.countDocuments(query);

   
    let externalMovies = [];
    let totalExternalCount = 0;

    if (localMovies.length < limit) {
      const remainingLimit = limit - localMovies.length;
      const externalPage = Math.floor((page * limit - localCount) / limit) + 1;
      
      if (search) {
        // If there's a search query, fetch from TMDB
        const searchResults = await searchTMDBMovies(search, externalPage, remainingLimit);
        externalMovies = searchResults.movies;
        totalExternalCount = searchResults.totalResults;
      } else {
        // If it's not a search, fetch popular movies
        const startIndex = (externalPage - 1) * remainingLimit;
        const endIndex = startIndex + remainingLimit;
        const pageMovieIds = popularMovieIds.slice(startIndex, endIndex);
        externalMovies = await Promise.all(pageMovieIds.map(fetchTMDBMovie));
        totalExternalCount = popularMovieIds.length;
      }
    }


    const combinedMovies = [...localMovies, ...externalMovies];
    const totalCount = localCount + totalExternalCount;

    res.json({
      data: combinedMovies,
      page,
      pages: Math.ceil(totalCount / limit),
      total: totalCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const searchMovies = async (req, res) => {
  try {
    const { query = '' } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Search local database
    const localQuery = {
      name: { $regex: query, $options: 'i' }
    };

    const localMovies = await Movie.find(localQuery)
      .populate('producer', 'name')
      .populate('actors', 'name')
      .limit(limit)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const localCount = await Movie.countDocuments(localQuery);

    // Search TMDB
    let externalMovies = [];
    let totalExternalResults = 0;
    if (query) {
      const tmdbResponse = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=${page}&include_adult=false`
      );
      const tmdbData = await tmdbResponse.json();
      
      if (tmdbData.results && tmdbData.results.length > 0) {
        externalMovies = await Promise.all(tmdbData.results.map(async (movie) => {
          const detailsResponse = await fetch(
            `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${process.env.TMDB_API_KEY}&language=en-US`
          );
          const details = await detailsResponse.json();
          return {
            name: movie.title,
            yearOfRelease: new Date(movie.release_date).getFullYear(),
            poster: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
            plot: movie.overview,
            isExternal: true,
            externalId: movie.id.toString(),
            producer: details.production_companies[0]?.name || 'Unknown',
            actors: details.credits?.cast?.slice(0, 5).map(actor => actor.name) || []
          };
        }));
        totalExternalResults = tmdbData.total_results;
      }
    }

    // Combine and paginate results
    const combinedMovies = [...localMovies, ...externalMovies];
    const totalResults = localCount + totalExternalResults;
    const totalPages = Math.ceil(totalResults / limit);

    res.json({
      movies: combinedMovies.slice(0, limit),
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

    const movie = await Movie.create({
      name,
      yearOfRelease,
      plot,
      poster,
      producer,
      actors
    });

    const populatedMovie = await Movie.findById(movie._id)
      .populate('producer', 'name')
      .populate('actors', 'name');

    res.status(201).json(populatedMovie);
  } catch (error) {
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

    const updatedMovie = await Movie.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
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