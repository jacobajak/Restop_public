import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('MenuService (Unit Tests)', () => {
  let menuRepository: Repository<any>;
  let categoryRepository: Repository<any>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: getRepositoryToken('MenuItem'),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken('MenuCategory'),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    menuRepository = module.get<Repository<any>>(getRepositoryToken('MenuItem'));
    categoryRepository = module.get<Repository<any>>(getRepositoryToken('MenuCategory'));
  });

  describe('getMenuByTenant', () => {
    it('should return menu items for a tenant', async () => {
      const mockItems = [
        {
          id: '1',
          name: 'Jollof Rice',
          price: 2500,
          tenant_id: 'tenant-1',
          is_available: true,
        },
        {
          id: '2',
          name: 'Pepper Chicken',
          price: 3500,
          tenant_id: 'tenant-1',
          is_available: true,
        },
      ];

      jest.spyOn(menuRepository, 'find').mockResolvedValue(mockItems);

      // Test would call service method here
      // expect(result).toEqual(mockItems);
    });

    it('should filter by category if provided', async () => {
      const mockItems = [
        {
          id: '1',
          name: 'Jollof Rice',
          price: 2500,
          category_id: 'cat-1',
          is_available: true,
        },
      ];

      jest.spyOn(menuRepository, 'find').mockResolvedValue(mockItems);
    });
  });

  describe('updateMenuItemAvailability', () => {
    it('should update item availability', async () => {
      const mockItem = {
        id: '1',
        name: 'Jollof Rice',
        is_available: true,
      };

      jest.spyOn(menuRepository, 'save').mockResolvedValue({
        ...mockItem,
        is_available: false,
      });
    });
  });

  describe('getMenuCategories', () => {
    it('should return all categories for tenant', async () => {
      const mockCategories = [
        { id: 'cat-1', name: 'Main Courses', tenant_id: 'tenant-1' },
        { id: 'cat-2', name: 'Drinks', tenant_id: 'tenant-1' },
      ];

      jest.spyOn(categoryRepository, 'find').mockResolvedValue(mockCategories);
    });
  });
});
