/**
 * MSW handlers that mirror json-server's REST routes for every collection in
 * db.json, including its status codes: 201 on create, 404 for unknown
 * collections or ids, and 400 when the body is not a JSON object.
 */
import { delay, http, HttpResponse } from 'msw';

import { API_BASE_URL } from '@/utils/constants';

import { mockDb } from './db';
import { queryCollection, type JsonRecord } from './jsonServerQuery';

const base = API_BASE_URL.replace(/\/$/, '');

type Params = { name: string; id: string };

function notFound() {
  return HttpResponse.json({ error: 'Not Found' }, { status: 404 });
}

function badRequest() {
  return HttpResponse.json(
    { error: 'Body must be a JSON object' },
    { status: 400 },
  );
}

async function readBody(request: Request): Promise<JsonRecord | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as JsonRecord)
      : null;
  } catch {
    return null;
  }
}

function updateHandler(patch: boolean) {
  return async ({ request, params }: { request: Request; params: Params }) => {
    await delay();
    const body = await readBody(request);
    if (!body) return badRequest();
    const item = mockDb.update(params.name, params.id, body, { patch });
    return item ? HttpResponse.json(item) : notFound();
  };
}

export const handlers = [
  http.get<Params>(`${base}/:name`, async ({ request, params }) => {
    await delay();
    if (!mockDb.has(params.name)) return notFound();
    const { searchParams } = new URL(request.url);
    return HttpResponse.json(
      queryCollection(mockDb.list(params.name), searchParams),
    );
  }),

  http.get<Params>(`${base}/:name/:id`, async ({ params }) => {
    await delay();
    const item = mockDb.findById(params.name, params.id);
    return item ? HttpResponse.json(item) : notFound();
  }),

  http.post<Params>(`${base}/:name`, async ({ request, params }) => {
    await delay();
    const body = await readBody(request);
    if (!body) return badRequest();
    const item = mockDb.create(params.name, body);
    return item ? HttpResponse.json(item, { status: 201 }) : notFound();
  }),

  http.put<Params>(`${base}/:name/:id`, updateHandler(false)),
  http.patch<Params>(`${base}/:name/:id`, updateHandler(true)),

  http.delete<Params>(`${base}/:name/:id`, async ({ params }) => {
    await delay();
    const item = mockDb.remove(params.name, params.id);
    return item ? HttpResponse.json(item) : notFound();
  }),
];
