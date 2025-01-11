import Movie from '../models/Movie.js';
import fetch from 'node-fetch';


export const getMovies = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';

    const query = search ? {
      name: { $regex: search, $options: 'i' }
    } : {};

    const movies = await Movie.find()
      .populate('producer', 'name')
      .populate('actors', 'name')
      .limit(limit)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await Movie.countDocuments(query);
    let externalMovies = [];
    if (search) {
      const omdbResponse = await fetch(
        `http://www.omdbapi.com/?s=${search}&apikey=${process.env.OMDB_API_KEY}`
      );
      const omdbData = await omdbResponse.json();
      
      if (omdbData.Search) {
        externalMovies = omdbData.Search.map(movie => ({
          ...movie,
          isExternal: true,
          externalId: movie.imdbID
        }));
      }
    }

    res.json({
      movies: [...movies, ...externalMovies],
      page,
      pages: Math.ceil(count / limit),
      total: count + externalMovies.length
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
  
      const localQuery = {
        name: { $regex: query, $options: 'i' }
      };
  
      const movies = await Movie.find(localQuery)
        .populate('producer', 'name')
        .populate('actors', 'name')
        .limit(limit)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });
  
      const count = await Movie.countDocuments(localQuery);
  
      
      let externalMovies = [];
      if (query) {
        const omdbResponse = await fetch(
          `http://www.omdbapi.com/?s=${query}&apikey=${process.env.OMDB_API_KEY}`
        );
        const omdbData = await omdbResponse.json();
        
        if (omdbData.Response === 'True' && omdbData.Search) {
          externalMovies = omdbData.Search.map(movie => ({
            ...movie,
            isExternal: true,
            externalId: movie.imdbID,
            // Transform OMDB fields to match our schema
            name: movie.Title,
            yearOfRelease: parseInt(movie.Year),
            poster: movie.Poster
          }));
        }
      }
  
      res.json({
        movies: [...movies, ...externalMovies],
        page,
        pages: Math.ceil((count + externalMovies.length) / limit),
        total: count + externalMovies.length
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
export const getMovieById = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id)
      .populate('producer', 'name gender dateOfBirth bio')
      .populate('actors', 'name gender dateOfBirth bio');

    if (movie) {
      res.json(movie);
    } else {
      // fetching from OMDB if not found locally
      const omdbResponse = await fetch(
        `http://www.omdbapi.com/?i=${req.params.id}&apikey=${process.env.OMDB_API_KEY}`
      );
      const omdbData = await omdbResponse.json();
      
      if (omdbData.Response === 'True') {
        res.json({
          ...omdbData,
          isExternal: true,
          externalId: omdbData.imdbID
        });
      } else {
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