import prisma from '../prismaClient.js';
import express from 'express';
import { authenticateUser } from '../middleware/authMiddleware.js';

const router = express.Router();
const blocked = 'BLOCKED';
const activeStatus = 'ACTIVE';

router.get('/', authenticateUser, async (req, res) => {
  try {
    const { 
      sort = 'lastLogin', 
      order = 'desc', 
      status,
      search = '',
      page = 1,
      pageSize = 10
    } = req.query;

    const validSortFields = ['name', 'email', 'lastLogin', 'lastActivity', 'createdAt', 'status'];
    const validOrders = ['asc', 'desc'];
    
    if (!validSortFields.includes(sort)) {
      return res.status(400).json({ error: `Invalid sort field. Valid fields: ${validSortFields.join(', ')}` });
    }
    
    if (!validOrders.includes(order)) {
      return res.status(400).json({ error: "Invalid order. Use 'asc' or 'desc'" });
    }

    const whereClause = {
      AND: [
        { status: status ? { equals: status } : undefined },
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
          ]
        }
      ].filter(Boolean)
    };

    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          lastLogin: true,
          lastActivity: true,
          createdAt: true,
          activities: {
            orderBy: { timestamp: 'desc' },
            take: 5, 
            select: { action: true, timestamp: true }
          }
        },
        orderBy: { [sort]: order },
        skip: (page - 1) * pageSize,
        take: Number(pageSize)
      }),
      prisma.user.count({ where: whereClause })
    ]);

    const formattedUsers = users.map(user => ({
      ...user,
      lastLogin: user.lastLogin.toISOString(),
      lastActivity: user.lastActivity.toISOString(),
      createdAt: user.createdAt.toISOString(),
      activities: user.activities.map(activity => ({
        ...activity,
        timestamp: activity.timestamp.toISOString()
      }))
    }));

    await prisma.activity.create({
      data: {
        userId: req.session.userId,
        action: 'VIEWED_USERS_TABLE',
        metadata: JSON.stringify({ sort, order, status, search })
      }
    });

    res.json({
      success: true,
      data: formattedUsers,
      pagination: {
        total: totalCount,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(totalCount / pageSize)
      },
      sorting: { sort, order }
    });

  } catch (error) {
    console.error('[Users Endpoint Error]', error);
    
    await prisma.activity.create({
      data: {
        userId: req.session.userId,
        action: 'USERS_ENDPOINT_ERROR',
        metadata: JSON.stringify({ error: error.message })
      }
    });

    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch users',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

router.put('/block', async (req, res) => {
  const { users } = req.body;
  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ message: 'Users are required to block', success: false });
  }

  try {
    await prisma.user.updateMany({
      where: {
        id: { in: users }
      },
      data: { status: blocked }
    });

    res.status(200).json({ success: true, message: 'Users blocked successfully' });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Failed to block users',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

router.delete('/delete', async (req, res) => {
  const { users } = req.body;
  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ message: 'Users are required to delete', success: false });
  }

  try {
    await prisma.user.deleteMany({
      where: {
        id: { in: users }
      }
    });

    res.status(200).json({ success: true, message: 'Users deleted successfully' });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete users',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

router.put('/activate', async (req, res) => {
  const { users } = req.body;
  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ message: 'Users are required to activate', success: false });
  }

  try {
    await prisma.user.updateMany({
      where: {
        id: { in: users }
      },
      data: { status: activeStatus }
    });

    res.status(200).json({ success: true, message: 'Users activated successfully' });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Failed to activate users',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});



export default router;