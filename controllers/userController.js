import User from '../models/User.js';
import jwt from "jsonwebtoken";

const registerUser = async (req, res) =>{
    const { username, email, password}=req.body;
    try{
        const existingUser = User.findOne({email});
        if(existingUser) return res.status(400).json({message: "User already exists"});

        const user = new User({username, email, password});
        await user.save();

        const token = jwt.sign({id:user._id}, process.env.JWT_SECRET, {expiresIn: '1hr'});
        res.status(201).json({token, username: user.username});

    }catch(err){
        res.status(500).json({error: "Registration failed"});
    }
}

const loginUser = async ( req, res) =>{
    const { email, password} = req.body;
    try{
        const user  = User.findOne({email});
        if(!user || !(await user.matchPassword(password))){
            return res.status(400).json({message: "Invalid email or password"})
        }
        const token = jwt.sign({id: user._id}, process.env.JWT_SECRET, {expiresIn:'1hr'});
        res.json({token, username: user.username});

    }catch(err){
        res.status(500).json({error: 'Login failed'});
    }
}
const getCurrentUser = async (req, res)=>{
    const user = User.findById(req.user.id).select('-password');
    res.json(user);
}

export  {registerUser , loginUser, getCurrentUser};