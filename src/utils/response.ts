import { Response } from 'express';
import { ApiResponse } from '../types';

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200
): void => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  message = 'Internal Server Error',
  statusCode = 500,
  error?: string
): void => {
  const response: ApiResponse = {
    success: false,
    message,
    error,
  };
  res.status(statusCode).json(response);
};

export const sendPagination = <T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number,
  message = 'Success'
): void => {
  const safeTotal = Number(total);
  const safeLimit = Number(limit);
  const safePage = Number(page);
  const totalPages = safeLimit > 0 ? Math.ceil(safeTotal / safeLimit) : 0;
  const response: ApiResponse<T[]> = {
    success: true,
    data,
    message,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: safeTotal,
      totalPages,
    },
  };
  res.status(200).json(response);
};