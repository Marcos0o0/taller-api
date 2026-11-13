jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('../../src/models/Counter', () => ({ findOneAndUpdate: jest.fn() }));
const axios = require('axios');
const Counter = require('../../src/models/Counter');
const { correctWriting } = require('../../src/services/writingService');
beforeEach(() => { jest.clearAllMocks(); process.env.GEMINI_API_KEY = 'unit-test-key'; Counter.findOneAndUpdate.mockResolvedValue({ value: 1 }); });
afterAll(() => { delete process.env.GEMINI_API_KEY; });
const answer = text => ({ data: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ text }) }] } }] } });
test('corrige escritura sin enviar datos adicionales ni repetir consultas', async () => {
  axios.post.mockResolvedValue(answer('Terminales de dirección'));
  expect((await correctWriting('Terminales de direccion')).text).toBe('Terminales de dirección');
  await correctWriting('Terminales de direccion');
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(axios.post.mock.calls[0][1])).toContain('Terminales de direccion');
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
  delete process.env.GEMINI_API_KEY;
  expect((await correctWriting('Sin configuracion')).reason).toBe('disabled');
});
