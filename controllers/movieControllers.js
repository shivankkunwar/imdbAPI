import Movie from '../models/Movie.js';
import fetch from 'node-fetch';

const popularMovieIds = [
  'tt0111161', 'tt0068646', 'tt0071562', 'tt0468569', 'tt0050083', 'tt0108052',
  'tt0167260', 'tt0110912', 'tt0060196', 'tt0120737', 'tt0109830', 'tt0137523',
  'tt0080684', 'tt1375666', 'tt0167261', 'tt0073486', 'tt0099685', 'tt0133093',
  'tt0047478', 'tt0114369'
];
const fetchOMDBMovies = async (ids) => {
  const omdbMovies = await Promise.all(ids.map(async (id) => {
    const response = await fetch(`http://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}&i=${id}`);
    const data = await response.json();
    return {
      name: data.Title,
      yearOfRelease: parseInt(data.Year),
      poster: data.Poster,
      plot: data.Plot,
      isExternal: true,
      externalId: data.imdbID
    };
  }));
  return omdbMovies;
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
      .limit(limit);

    const localCount = await Movie.countDocuments(query);

    let omdbMovies = [];
    if (!search) {
      // If no search query, use predefined list
      omdbMovies = await fetchOMDBMovies(popularMovieIds);
    } else {
      // If there's a search query, search OMDB
      const omdbResponse = await fetch(
        `http://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}&s=${search}&type=movie&page=${page}`
      );
      const omdbData = await omdbResponse.json();
      if (omdbData.Search) {
        omdbMovies = await Promise.all(omdbData.Search.map(async (movie) => {
          const detailResponse = await fetch(`http://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}&i=${movie.imdbID}`);
          const detailData = await detailResponse.json();
          return {
            name: detailData.Title,
            yearOfRelease: parseInt(detailData.Year),
            poster: detailData.Poster,
            plot: detailData.Plot,
            isExternal: true,
            externalId: detailData.imdbID
          };
        }));
      }
    }

    const combinedMovies = [...localMovies, ...omdbMovies].slice(0, limit);
    const totalCount = localCount + (search ? omdbMovies.length : popularMovieIds.length);

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