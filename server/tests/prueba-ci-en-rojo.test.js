// Test roto A PROPÓSITO. Tarjeta `cf23ea72`: comprueba que un PR con la batería
// en rojo NO se puede fusionar. Esta rama y su PR se cierran en cuanto se mida.
it('falla a propósito para poner el CI en rojo', () => {
  expect(1).toBe(2);
});
