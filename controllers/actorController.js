import Actor from '../models/Actor.js';


export const getActors = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';

    const query = search ? {
      name: { $regex: search, $options: 'i' }
    } : {};

    const actors = await Actor.find(query)
      .limit(limit)
      .skip((page - 1) * limit)
      .sort({ name: 1 });

    const count = await Actor.countDocuments(query);

    res.json({
      actors,
      page,
      pages: Math.ceil(count / limit),
      total: count
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
      res.status(404).json({ message: 'Actor not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createActor = async (req, res) => {
  try {
    const actor = await Actor.create(req.body);
    res.status(201).json(actor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateActor = async (req, res) => {
  try {
    const actor = await Actor.findById(req.params.id);

    if (!actor) {
      return res.status(404).json({ message: 'Actor not found' });
    }

    const updatedActor = await Actor.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json(updatedActor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const deleteActor = async (req, res) => {
  try {
    const actor = await Actor.findById(req.params.id);

    if (!actor) {
      return res.status(404).json({ message: 'Actor not found' });
    }

    await actor.remove();
    res.json({ message: 'Actor removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};