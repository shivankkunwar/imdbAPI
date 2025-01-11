import Producer from '../models/Producer.js';


export const getProducers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';

    const query = search ? {
      name: { $regex: search, $options: 'i' }
    } : {};

    const producers = await Producer.find(query)
      .limit(limit)
      .skip((page - 1) * limit)
      .sort({ name: 1 });

    const count = await Producer.countDocuments(query);

    res.json({
      producers,
      page,
      pages: Math.ceil(count / limit),
      total: count
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
      res.status(404).json({ message: 'Producer not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createProducer = async (req, res) => {
  try {
    const producer = await Producer.create(req.body);
    res.status(201).json(producer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProducer = async (req, res) => {
  try {
    const producer = await Producer.findById(req.params.id);

    if (!producer) {
      return res.status(404).json({ message: 'Producer not found' });
    }

    const updatedProducer = await Producer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json(updatedProducer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const deleteProducer = async (req, res) => {
  try {
    const producer = await Producer.findById(req.params.id);

    if (!producer) {
      return res.status(404).json({ message: 'Producer not found' });
    }

    await producer.remove();
    res.json({ message: 'Producer removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};