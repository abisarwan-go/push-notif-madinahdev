import { hc } from "hono/client";

export type RpcClient = {
	v1: {
		users: {
			register: { $post(args: { json: unknown }): Promise<Response> };
			login: { $post(args: { json: unknown }): Promise<Response> };
		};
		rooms: {
			mine: {
				$get(
					args?: object,
					options?: { headers?: Record<string, string> },
				): Promise<Response>;
			};
			create: {
				$post(
					args: { json: unknown },
					options?: { headers?: Record<string, string> },
				): Promise<Response>;
			};
			join: {
				$post(
					args: { json: unknown },
					options: { headers: Record<string, string> },
				): Promise<Response>;
			};
			":roomName": {
				config: { $get(args: { param: { roomName: string } }): Promise<Response> };
				subscribe: { $post(args: { param: { roomName: string }; json: unknown }): Promise<Response> };
				dashboard: {
					$get(
						args: { param: { roomName: string } },
						options?: { headers?: Record<string, string> },
					): Promise<Response>;
				};
				notifications: {
					$post(
						args: { param: { roomName: string }; json: unknown },
						options?: { headers?: Record<string, string> },
					): Promise<Response>;
				};
			};
		};
	};
};

const rpcClient = hc("/") as unknown as RpcClient;

export default rpcClient;
