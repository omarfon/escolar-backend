import { Test, TestingModule } from '@nestjs/testing';
import { CatalogCacheService } from './catalog-cache.service';

describe('CatalogCacheService', () => {
  let service: CatalogCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CatalogCacheService],
    }).compile();
    service = module.get(CatalogCacheService);
  });

  it('almacena y recupera valores', async () => {
    let calls = 0;
    const value = await service.wrap('demo:key', async () => {
      calls++;
      return ['a'];
    });
    expect(value).toEqual(['a']);
    expect(calls).toBe(1);

    const cached = await service.wrap('demo:key', async () => {
      calls++;
      return ['b'];
    });
    expect(cached).toEqual(['a']);
    expect(calls).toBe(1);
  });

  it('invalida por prefijo', async () => {
    service.set('salones:list:{}', [1]);
    service.invalidate('salones:');
    expect(service.get('salones:list:{}')).toBeNull();
  });
});
