jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('../../src/models/Counter', () => ({ findOneAndUpdate: jest.fn() }));
const axios = require('axios');
const Counter = require('../../src/models/Counter');
const { correctWriting } = require('../../src/services/writingService');
beforeEach(() => { jest.clearAllMocks(); process.env.GROQ_API_KEY = 'unit-test-key'; Counter.findOneAndUpdate.mockResolvedValue({ value: 1 }); });
afterAll(() => { delete process.env.GROQ_API_KEY; });
const answer = text => ({ data: { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ text }) } }] } });
test('corrige escritura sin enviar datos adicionales ni repetir consultas', async () => {
  axios.post.mockResolvedValue(answer('Terminales de dirección'));
  expect((await correctWriting('Terminales de direccion')).text).toBe('Terminales de dirección');
  await correctWriting('Terminales de direccion');
  expect(axios.post).toHaveBeenCalledTimes(1);
  const [url, body, options] = axios.post.mock.calls[0];
  expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
  expect(body.model).toBe('openai/gpt-oss-20b');
  expect(body.messages[1]).toEqual({ role: 'user', content: JSON.stringify({ text: 'Terminales de direccion' }) });
  expect(body.response_format.json_schema.strict).toBe(true);
  expect(options.headers.Authorization).toBe('Bearer unit-test-key');
});
test('una respuesta que cambia números se descarta', async () => {
  axios.post.mockResolvedValue(answer('Anticongelante 60/40'));
  expect((await correctWriting('Anticongelante 50/50')).text).toBe('Anticongelante 50/50');
});
test('fallos, falta de clave y límite mensual conservan el original', async () => {
  axios.post.mockRejectedValue(new Error('provider failed'));
  expect((await correctWriting('Rotulas bandeja')).text).toBe('Rotulas bandeja');
  axios.post.mockRejectedValue({ response: { status: 402 } });
  expect((await correctWriting('Trabajo con saldo agotado')).reason).toBe('billing');
  Counter.findOneAndUpdate.mockResolvedValue({ value: 2001 });
  expect((await correctWriting('Otro trabajo')).reason).toBe('limit');
  delete process.env.GROQ_API_KEY;
  expect((await correctWriting('Sin configuracion')).reason).toBe('disabled');
});

test('una cuota agotada o una respuesta truncada conserva el texto', async () => {
  axios.post.mockRejectedValue({ response: { status: 429 } });
  expect(await correctWriting('Rotulas superiores')).toMatchObject({ text: 'Rotulas superiores', available: false });
  axios.post.mockResolvedValue({ data: { choices: [{ finish_reason: 'length', message: { content: '{"text":"Rótulas"}' } }] } });
  expect((await correctWriting('Rotulas inferiores')).text).toBe('Rotulas inferiores');
});
