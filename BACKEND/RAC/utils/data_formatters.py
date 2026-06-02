



def extract_first_error(errors):
    if isinstance(errors, dict):
        return extract_first_error(next(iter(errors.values())))
    if isinstance(errors, list):
        return extract_first_error(errors[0])
    return str(errors)

class CleanZerosMixin:
    def to_internal_value(self, data):
        def limpiar_recursivo(item):
            if isinstance(item, dict):
                nuevo_dict = {}
                for k, v in item.items():
                    if v in [0, "0", "None", None, "undefined", "null", ""]:
                        nuevo_dict[k] = None
                    else:
                        nuevo_dict[k] = limpiar_recursivo(v)
                return nuevo_dict
            
            elif isinstance(item, list):
                return [limpiar_recursivo(i) for i in item if i not in [0, "0", "None", None, "undefined", "null", ""]]
            
            return item
            
        data_limpia = limpiar_recursivo(data)
        return super().to_internal_value(data_limpia)