# This is a regular Python file
# In Zos Pad, ANY non-.zos file must open as plain text with NO syntax highlighting

def calculate_factorial(n: int) -> int:
    """Calculate factorial of n"""
    if n <= 1:
        return 1
    return n * calculate_factorial(n - 1)

class ServerConfig:
    def __init__(self, host: str = "localhost", port: int = 8080):
        self.host = host
        self.port = port

if __name__ == "__main__":
    print(f"Factorial of 5: {calculate_factorial(5)}")
