/**
 * Substituto do pacote `server-only` nos testes.
 *
 * O pacote de verdade lança erro quando é importado fora do servidor do Next —
 * é assim que ele marca a fronteira. Como o Vitest roda em Node puro, importar
 * o original derrubaria qualquer teste de módulo de servidor, então o alias em
 * `vitest.config.mts` aponta pra cá.
 */
export {};
