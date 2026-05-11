import { IsString, IsNumber, IsArray, Min, Max, IsOptional, IsPositive } from 'class-validator';

/**
 * DTOs for currency-related operations
 */

/**
 * Update tenant currency request
 */
export class UpdateCurrencyDto {
  @IsString()
  currency: string;
}

/**
 * Update tenant country request
 */
export class UpdateCountryDto {
  @IsString()
  country_code: string;
}

/**
 * Convert currency request
 */
export class ConvertCurrencyDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  from: string;

  @IsString()
  to: string;
}

/**
 * Convert with fee request
 */
export class ConvertWithFeeDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  from: string;

  @IsString()
  to: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  feePercentage?: number;
}

/**
 * Multiple exchange rates request
 */
export class MultipleExchangeRatesDto {
  @IsString()
  from: string;

  @IsArray()
  @IsString({ each: true })
  to: string[];
}

/**
 * Payment split request
 */
export class PaymentSplitDto {
  @IsNumber()
  @IsPositive()
  totalAmount: number;

  @IsString()
  fromCurrency: string;

  @IsArray()
  splits: Array<{
    toCurrency: string;
    percentage: number;
  }>;
}
