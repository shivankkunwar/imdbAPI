import User from '../models/User.js';
import jwt from "jsonwebtoken";


const registerUser = async (req, res) =>{
    const { username, email, password } = req.body;
    try {
        const existingUser = await User.findOne({ email });
        if(existingUser) return res.status(400).json({message: "User already exists"});
        const user = new User({username, email, password});
        await user.save();
        const token = jwt.sign({id: user._id}, process.env.JWT_SECRET, {expiresIn: '2hr'});
        res.status(201).json({token, username: user.username});

    } catch(err) {
        res.status(500).json({error: "Registration failed"});
    }
}

const loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email }); 
        if (!user) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '2hr' });
        res.json({ token, username: user.username });

    } catch(err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
}

const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching user' });
    }
}

export  {registerUser , loginUser, getCurrentUser};