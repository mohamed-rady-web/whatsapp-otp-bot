// Test setup file
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.WHATSAPP_HEADLESS = 'true';
process.env.LOG_LEVEL = 'error';

// Suppress console output during tests
if (process.env.NODE_ENV === 'test') {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
}