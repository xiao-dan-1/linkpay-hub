export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function notFoundError() {
  return new AppError(404, 'NOT_FOUND', '请求的资源不存在')
}
