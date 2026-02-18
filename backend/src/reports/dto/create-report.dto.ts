import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreateReportDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  location: string;

  @IsOptional()
  @IsString()
  wasteType?: string;

  @IsOptional()
  @IsString()
  fillLevel?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}
