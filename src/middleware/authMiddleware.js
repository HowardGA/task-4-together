import prisma from '../prismaClient.js';
import bcrypt from 'bcryptjs';


export const authenticateUser = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        lastLogin: true
      }
    });

    if (!user || user.status === 'BLOCKED') {
      req.session.destroy();
      return res.status(401).json({ error: 'Session invalid' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const validateCredentials = async (req, res, next) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'BLOCKED') {
      return res.status(403).json({ error: 'Account blocked' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: 'Login failed'});
  }
};