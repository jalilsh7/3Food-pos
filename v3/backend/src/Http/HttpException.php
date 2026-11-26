<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Http;

use PersiaCoder\PosV3\Support\ApplicationException;

/** Backward-compatible HTTP adapter exception; application services use ApplicationException. */
final class HttpException extends ApplicationException
{
}
