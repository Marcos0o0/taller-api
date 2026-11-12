jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/models/Device', () => ({ findOne: jest.fn() }));
const User = require('../../src/models/User');
const Device = require('../../src/models/Device');
const { resolveUser } = require('../../src/middlewares/auth');
const { createHash } = require('crypto');

describe('PC vinculado', () => {
  const token = `device_${'a'.repeat(64)}`;
  const owner = { _id: 'owner', role: 'admin', isLocked: () => false };

  test('solo consulta el hash y conserva al propietario para auditoría', async () => {
    Device.findOne.mockResolvedValue({ userId: 'owner' });
    User.findById.mockResolvedValue(owner);
    await expect(resolveUser(token)).resolves.toBe(owner);
    expect(Device.findOne).toHaveBeenCalledWith({
      tokenHash: createHash('sha256').update(token).digest('hex'),
      revokedAt: null,
    });
  });

  test('rechaza un equipo revocado o inexistente', async () => {
    Device.findOne.mockResolvedValue(null);
    await expect(resolveUser(token)).resolves.toBeNull();
  });

  test('rechaza credenciales mal formadas sin consultar dispositivos', async () => {
    await expect(resolveUser('device_short')).resolves.toBeNull();
    expect(Device.findOne).not.toHaveBeenCalled();
  });

  test('rechaza equipos cuyo propietario ya no es administrador', async () => {
    Device.findOne.mockResolvedValue({ userId: 'owner' });
    User.findById.mockResolvedValue({ ...owner, role: 'mechanic' });
    await expect(resolveUser(token)).resolves.toBeNull();
  });
  test('un bloqueo temporal de contraseña conserva el acceso del PC vinculado', async () => {
    Device.findOne.mockResolvedValue({ userId: 'owner' });
    User.findById.mockResolvedValue({ ...owner, isLocked: () => true });
    await expect(resolveUser(token)).resolves.toBeTruthy();
  });
});
