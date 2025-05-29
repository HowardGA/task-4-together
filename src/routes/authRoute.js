import prisma from '../prismaClient.js';
import express from 'express';
import bcrypt from 'bcryptjs';
import {
  validateCredentials
} from '../middleware/authMiddleware.js';

const router = express.Router();
const activeStatus = 'ACTIVE';

router.post('/register', async (req, res) => {
    const {name, email, password} = req.body;
    if (!name || !email || !password) 
        return res.status(400).json({message: 'All fields are required', status: 'error'});

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) 
        return res.status(400).json({ message: 'Email format invalid', status: 'error' });
    
    try {
        const hashedPassword = bcrypt.hashSync(password, 10);
        const newUser = await prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
                status: activeStatus
            }
        })

       req.session.userId = newUser.id;

        return res.status(201).json({
          message: 'User registered and logged in',
          status: 'success',
          user: newUser
        });

    }catch (error) {
       if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
          return res.status(409).json({ message: 'Email already exists', status: 'error' });
        }
        return res.status(500).json({message: 'Error at registering user', status: 'error', error:  error});
    }
});

router.post('/login', validateCredentials, async (req, res) => {
  try {
    req.session.userId = req.user.id;
    
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        status: req.user.status
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login processing failed', em: req.user });
  }
});

router.get('/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(200).json({ user: null });
  }
  const user = await prisma.user.findFirst(
   { where:{
        id:req.session.userId}});
  res.json({ user });
});

router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.clearCookie('user.sid'); 
    res.status(200).json({ message: 'Logged out successfully' });
  });
});


export default router;