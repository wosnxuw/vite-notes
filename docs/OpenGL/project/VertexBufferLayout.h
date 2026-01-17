#pragma once

#include <vector>

#include <GL/glew.h>

struct VertexBufferElement
{
	unsigned int type;
	int count;
	unsigned int normalized;

	static unsigned int GetSizeOfType(unsigned int type)
	{
		switch (type)
		{
		case GL_FLOAT:
		case GL_UNSIGNED_INT:
			return 4;
		case GL_UNSIGNED_BYTE:
			return 1;
		default:
			return 0;
		}
	}

};
// 这个相当于是那里面的一小块，每个小块用一个Element来定义

class VertexBufferLayout
{
private:
	std::vector<VertexBufferElement> m_Elements;
	unsigned int m_Stride = 0;
public:
	VertexBufferLayout();
	~VertexBufferLayout();


	template<typename T>
	void Push(int count)
	{
		static_assert(false);
	}

	template<>
	void Push<float>(int count)
	{
		m_Elements.push_back({ GL_FLOAT , count, false });
		m_Stride += 4 * count;
	}

	template<>
	void Push<unsigned int>(int count)
	{
		m_Elements.push_back({ GL_UNSIGNED_INT , count, false });
		m_Stride += 4 * count;
	}

	template<>
	void Push<char>(int count)
	{
		m_Elements.push_back({ GL_UNSIGNED_BYTE , count, true });
		m_Stride += 1 * count;
	}

	inline const std::vector<VertexBufferElement> GetElements() const { return m_Elements; }
	inline unsigned int GetStride() const { return m_Stride; }
	
};