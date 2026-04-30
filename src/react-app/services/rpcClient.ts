import { hc } from "hono/client";

export type RpcClient = {
	v1: {
		users: {
			register: { $post(args: { json: unknown }): Promise<Response> };
			login: { $post(args: { json: unknown }): Promise<Response> };
		};
		rooms: {
			create: {
				$post(
					args: { json: unknown },
					options?: { headers?: Record<string, string> },
				): Promise<Response>;
			};
			owner: { login: { $post(args: { json: unknown }): Promise<Response> } };
			join: { $post(args: { json: unknown }): Promise<Response> };
			":roomSlug": {
				config: { $get(args: { param: { roomSlug: string } }): Promise<Response> };
				subscribe: { $post(args: { param: { roomSlug: string }; json: unknown }): Promise<Response> };
				dashboard: {
					$get(
						args: { param: { roomSlug: string } },
						options?: { headers?: Record<string, string> },
					): Promise<Response>;
				};
				notifications: {
					$post(
						args: { param: { roomSlug: string }; json: unknown },
						options?: { headers?: Record<string, string> },
					): Promise<Response>;
				};
			};
		};
	};
};

const rpcClient = hc("/") as unknown as RpcClient;

export default rpcClient;
