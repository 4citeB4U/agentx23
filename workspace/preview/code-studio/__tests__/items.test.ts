Lock it in.

===FILE: src/app.ts===
import request from 'supertest';
import express, { Request, Response } from 'express';
import { Item } from './item.model'; // Assuming you have an Item model

const app = express();
app.use(express.json());

// Mock data (replace with your actual data source/database)
let items: Item[] = [
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' },
];

// GET /items
app.get('/items', (req: Request, res: Response) => {
  res.status(200).json(items);
});

// POST /items
app.post('/items', (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const newItem: Item = { id: items.length + 1, name };
  items.push(newItem);
  res.status(201).json(newItem);
});

export default app;
===END===

===FILE: src/item.model.ts===
export interface Item {
  id: number;
  name: string;
}
===END===

===FILE: test/item.test.ts===
import request from 'supertest';
import app from '../src/app'; // Adjust the path as needed

describe('Item Routes', () => {
  it('GET /items should return 200 and an array', async () => {
    const res = await request(app).get('/items');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /items should return 201 with valid body', async () => {
    const res = await request(app)
      .post('/items')
      .send({ name: 'New Item' });
    expect(res.statusCode).toEqual(201);
    expect(res.body.name).toEqual('New Item');
  });

  it('POST /items should return 400 with missing name', async () => {
    const res = await request(app).post('/items').send({});
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toEqual('Name is required');
  });
});
===END===